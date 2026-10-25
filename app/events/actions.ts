"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { UserError } from "@/lib/inventory";
import { freeUnitsByPurchase, timesOverlap } from "@/lib/availability";
import { syncEventToCalendar, updateEventInCalendar } from "@/lib/event-calendar";
import { addMinutes } from "@/lib/time";
import {
  EVENT_BUFFER_MINUTES,
  EVENT_DURATION_MINUTES,
  isRealDate,
  dateToDate,
  minutesOfDay,
  timeToDate,
  timeToMinutes,
  TIME_RE,
} from "@/lib/events";

export type EventFormState = {
  error?: string;
  fieldErrors?: Record<string, string>;
};

const uuid = /^[0-9a-f-]{36}$/i;
const moneyRe = /^\d{1,8}(\.\d{1,2})?$/;

// ─────────────────────────────────────────────
// Free units for a date and time (drives the pickers in the form)
// excludeEventNo: when editing, the event's own reservations do not count against it
// ─────────────────────────────────────────────
export async function getFreeUnits(
  date: string,
  startTime: string,
  excludeEventNo?: number,
): Promise<{ free?: Record<string, number>; error?: string }> {
  const session = await auth();
  if (!session) return { error: "You are not signed in." };
  if (!isRealDate(date) || !TIME_RE.test(startTime)) {
    return { error: "Enter a valid date and start time." };
  }
  const start = timeToMinutes(startTime);
  const end = start + EVENT_DURATION_MINUTES; // every event lasts the same number of hours
  if (end >= 24 * 60) return { error: "That start time would end after midnight. Choose an earlier start." };

  const exclude =
    excludeEventNo && Number.isInteger(excludeEventNo) && excludeEventNo > 0 ? excludeEventNo : undefined;
  const free = await freeUnitsByPurchase(prisma, date, start, end, EVENT_BUFFER_MINUTES, exclude);
  return { free: Object.fromEntries(free) };
}

// ─────────────────────────────────────────────
// Reading and checking the form
// ─────────────────────────────────────────────
const schema = z.object({
  customerName: z.string().trim().min(1, "Required").max(150, "Max 150 characters"),
  customerPhone: z.string().trim().min(7, "Enter a phone number").max(20, "Max 20 characters"),
  customerEmail: z
    .string()
    .trim()
    .max(255, "Max 255 characters")
    .refine((v) => v === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "Enter a valid email"),
  eventAddress: z.string().trim().min(5, "Enter the address").max(500, "Max 500 characters"),
  notes: z.string().trim().max(1000, "Max 1000 characters"),
  date: z.string().refine(isRealDate, "Pick a date"),
  startTime: z.string().regex(TIME_RE, "Pick a start time"),
  assetId: z.string().refine((v) => v === "" || uuid.test(v), "Invalid set"),
  discount: z.string().trim().regex(/^(\d{1,8}(\.\d{1,2})?)?$/, "Use a number like 50 or 50.50"),
  downPaymentAmount: z.string().trim().regex(moneyRe, "Enter the down payment, like 500 or 500.50"),
});

type EventInput = z.infer<typeof schema> & {
  startMin: number;
  endMin: number;
  endTime: string; // HH:MM, always start + duration
  pickIds: string[];
  extras: Map<string, number>;
};

function parseEventForm(formData: FormData): { data: EventInput } | { state: EventFormState } {
  const parsed = schema.safeParse({
    customerName: formData.get("customerName") ?? "",
    customerPhone: formData.get("customerPhone") ?? "",
    customerEmail: formData.get("customerEmail") ?? "",
    eventAddress: formData.get("eventAddress") ?? "",
    notes: formData.get("notes") ?? "",
    date: formData.get("date") ?? "",
    startTime: formData.get("startTime") ?? "",
    assetId: formData.get("assetId") ?? "",
    discount: formData.get("discount") ?? "",
    downPaymentAmount: formData.get("downPaymentAmount") ?? "",
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      fieldErrors[key] ??= issue.message;
    }
    return { state: { fieldErrors } };
  }
  const d = parsed.data;

  const startMin = timeToMinutes(d.startTime);
  const endMin = startMin + EVENT_DURATION_MINUTES; // the end time is never typed: start + duration
  if (endMin >= 24 * 60) {
    return {
      state: {
        fieldErrors: {
          startTime: `Events last ${EVENT_DURATION_MINUTES / 60} hours and must end before midnight, so choose an earlier start.`,
        },
      },
    };
  }
  const endTime = addMinutes(d.startTime, EVENT_DURATION_MINUTES)!;

  // The down payment rule: an event is never scheduled without one
  if (!(Number(d.downPaymentAmount) > 0)) {
    return { state: { fieldErrors: { downPaymentAmount: "The down payment must be more than 0." } } };
  }

  // Items: picks for the set's rows, and extra rentals
  const pickIds = formData.getAll("pick").map(String).filter((id) => uuid.test(id));
  const extraIds = formData.getAll("extraItem").map(String);
  const extraQtys = formData.getAll("extraQty").map(Number);
  const extras = new Map<string, number>();
  extraIds.forEach((id, i) => {
    const qty = extraQtys[i];
    if (!uuid.test(id) || !Number.isInteger(qty) || qty <= 0) return;
    extras.set(id, (extras.get(id) ?? 0) + qty);
  });

  if (!d.assetId && extras.size === 0) {
    return { state: { error: "Choose a set or add at least one extra item." } };
  }

  return { data: { ...d, startMin, endMin, endTime, pickIds, extras } };
}

type Kind = "SET_FIXED" | "SET_PICK" | "EXTRA";
type Row = { purchaseId: string; kind: Kind; quantity: number; unitPrice: Prisma.Decimal | null };

// Prices an event already had: keep them when it is edited, so later price changes do not alter it
type Keep = {
  setId: string | null;
  setPrice: Prisma.Decimal | null;
  extraPrices: Map<string, Prisma.Decimal>;
};

// Checks the set, the picks and the extras against what is free, and prices them
async function planEvent(
  tx: Prisma.TransactionClient,
  d: EventInput,
  excludeEventNo: number | undefined,
  keep: Keep | null,
) {
  const free = await freeUnitsByPurchase(tx, d.date, d.startMin, d.endMin, EVENT_BUFFER_MINUTES, excludeEventNo);
  const names = new Map<string, string>();
  const used = new Map<string, number>();
  const use = (id: string, qty: number) => used.set(id, (used.get(id) ?? 0) + qty);
  const rows: Row[] = [];

  let setPrice = new Prisma.Decimal(0);
  const setId = d.assetId || null;

  if (setId) {
    const set = await tx.asset.findUnique({
      where: { assetId: setId },
      include: {
        slots: { include: { category: true } },
        fixedItems: { include: { purchase: true } },
      },
    });
    if (!set) throw new UserError("That set no longer exists.");
    setPrice = keep && keep.setId === setId && keep.setPrice ? keep.setPrice : set.assetPrice;

    // Optional cap on how many of this set can be out at the same time
    if (set.assetAmount) {
      const sameDay = await tx.event.findMany({
        where: {
          date: dateToDate(d.date),
          assets: { some: { assetId: setId } },
          ...(excludeEventNo ? { eventNo: { not: excludeEventNo } } : {}),
        },
      });
      const clashing = sameDay.filter((ev) =>
        timesOverlap(d.startMin, d.endMin, minutesOfDay(ev.startTime), minutesOfDay(ev.endTime), EVENT_BUFFER_MINUTES),
      ).length;
      if (clashing >= set.assetAmount) {
        throw new UserError(
          `"${set.assetName}" can only be rented ${set.assetAmount} at a time, and that limit is already reached for this time.`,
        );
      }
    }

    // Items that are always in the set
    for (const f of set.fixedItems) {
      names.set(f.purchaseId, f.purchase.assetName);
      use(f.purchaseId, f.quantity);
      rows.push({ purchaseId: f.purchaseId, kind: "SET_FIXED", quantity: f.quantity, unitPrice: null });
    }

    // Items chosen for the set's pick rows: exactly the amount each row asks for
    const pickPurchases = await tx.purchase.findMany({
      where: { purchaseId: { in: [...new Set(d.pickIds)] }, purchaseStatus: "COMPLETED" },
    });
    const byId = new Map(pickPurchases.map((p) => [p.purchaseId, p]));
    const perCategory = new Map<string, number>();
    const perPurchase = new Map<string, number>();
    for (const id of d.pickIds) {
      const p = byId.get(id);
      if (!p || !p.categoryId) throw new UserError("One of the chosen items is no longer available.");
      perCategory.set(p.categoryId, (perCategory.get(p.categoryId) ?? 0) + 1);
      perPurchase.set(id, (perPurchase.get(id) ?? 0) + 1);
      names.set(id, p.assetName);
    }
    for (const slot of set.slots) {
      if ((perCategory.get(slot.categoryId) ?? 0) !== slot.quantity) {
        throw new UserError(`Choose exactly ${slot.quantity} item(s) for "${slot.category.name}".`);
      }
    }
    for (const [categoryId] of perCategory) {
      if (!set.slots.some((s) => s.categoryId === categoryId)) {
        throw new UserError("One of the chosen items does not belong to this set.");
      }
    }
    for (const [id, qty] of perPurchase) {
      use(id, qty);
      rows.push({ purchaseId: id, kind: "SET_PICK", quantity: qty, unitPrice: null });
    }
  }

  // Extra rentals, charged at each item's rental price
  let extrasTotal = new Prisma.Decimal(0);
  if (d.extras.size > 0) {
    const extraPurchases = await tx.purchase.findMany({
      where: { purchaseId: { in: [...d.extras.keys()] }, purchaseStatus: "COMPLETED" },
    });
    for (const [id, qty] of d.extras) {
      const p = extraPurchases.find((x) => x.purchaseId === id);
      if (!p) throw new UserError("One of the extra items is no longer available.");
      const unit = keep?.extraPrices.get(id) ?? p.rentalPrice;
      if (!unit) {
        throw new UserError(`"${p.assetName}" has no rental price, so it can't be rented as an extra.`);
      }
      names.set(id, p.assetName);
      use(id, qty);
      extrasTotal = extrasTotal.add(unit.mul(qty));
      rows.push({ purchaseId: id, kind: "EXTRA", quantity: qty, unitPrice: unit });
    }
  }

  // Everything reserved must be free at that date and time
  for (const [id, qty] of used) {
    if (qty > (free.get(id) ?? 0)) {
      throw new UserError(`Not enough free units of "${names.get(id) ?? "an item"}" for that date and time.`);
    }
  }

  return { setId, setPrice, extrasTotal, rows };
}

function computeMoney(d: EventInput, setPrice: Prisma.Decimal, extrasTotal: Prisma.Decimal) {
  const subtotal = setPrice.add(extrasTotal);
  const discount = new Prisma.Decimal(d.discount || "0");
  if (discount.gt(subtotal)) throw new UserError("The discount cannot be more than the subtotal.");
  const total = subtotal.sub(discount);
  const down = new Prisma.Decimal(d.downPaymentAmount);
  if (down.gt(total)) throw new UserError("The down payment cannot be more than the rent total.");
  return { discount, total, down, pending: total.sub(down) };
}

function eventFields(d: EventInput, m: ReturnType<typeof computeMoney>) {
  return {
    customerName: d.customerName,
    customerPhone: d.customerPhone,
    customerEmail: d.customerEmail || null,
    eventAddress: d.eventAddress,
    notes: d.notes || null,
    date: dateToDate(d.date),
    startTime: timeToDate(d.startTime),
    endTime: timeToDate(d.endTime),
    downPaymentAmount: m.down,
    paymentComplete: m.pending.isZero(),
    pendingPayment: m.pending,
    discount: m.discount,
    rentTotalPrice: m.total,
  };
}

// ─────────────────────────────────────────────
// Schedule an event
// ─────────────────────────────────────────────
export async function createEvent(
  _prev: EventFormState,
  formData: FormData,
): Promise<EventFormState> {
  const session = await auth();
  if (!session) return { error: "You are not signed in." };

  const result = parseEventForm(formData);
  if ("state" in result) return result.state;
  const d = result.data;

  // The down payment rule: an event is never scheduled until it is paid
  if (formData.get("downPaymentReceived") !== "on") {
    return { error: "The down payment must be paid before the event can be scheduled." };
  }

  let eventNo = 0;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      eventNo = await prisma.$transaction(async (tx) => {
        const plan = await planEvent(tx, d, undefined, null);
        const money = computeMoney(d, plan.setPrice, plan.extrasTotal);

        // Next event number (running count)
        const last = await tx.event.aggregate({ _max: { eventNo: true } });
        const nextNo = (last._max.eventNo ?? 0) + 1;

        await tx.event.create({
          data: {
            eventNo: nextNo,
            ...eventFields(d, money),
            assets: plan.setId
              ? { create: [{ assetId: plan.setId, quantity: 1, price: plan.setPrice }] }
              : undefined,
            items: { create: plan.rows },
          },
        });
        return nextNo;
      });
      break;
    } catch (e) {
      if (e instanceof UserError) return { error: e.message };
      // two events saved at the same moment took the same number: try again
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002" && attempt < 2) continue;
      console.error("createEvent failed:", e);
      return { error: "Could not save the event. Please try again." };
    }
  }

  // The event is saved. Now add it to Google Calendar and invite the customer.
  const sync = await syncEventToCalendar(eventNo);
  revalidatePath("/events");

  if ("error" in sync) {
    redirect(`/events/${eventNo}?calendar=failed&msg=${encodeURIComponent(sync.error.slice(0, 300))}`);
  }
  redirect(`/events/${eventNo}?calendar=ok`);
}

// ─────────────────────────────────────────────
// Edit an event: customer info, date and time, items, payment
// ─────────────────────────────────────────────
export async function updateEvent(
  _prev: EventFormState,
  formData: FormData,
): Promise<EventFormState> {
  const session = await auth();
  if (!session) return { error: "You are not signed in." };

  const eventNo = Number(formData.get("eventNo"));
  if (!Number.isInteger(eventNo) || eventNo < 1) return { error: "Invalid event." };

  const result = parseEventForm(formData);
  if ("state" in result) return result.state;
  const d = result.data;

  try {
    await prisma.$transaction(async (tx) => {
      const existing = await tx.event.findUnique({
        where: { eventNo },
        include: { assets: true, items: true },
      });
      if (!existing) throw new UserError("This event no longer exists.");

      // What the event was priced at when it was booked
      const extraPrices = new Map<string, Prisma.Decimal>();
      let extrasSum = new Prisma.Decimal(0);
      for (const i of existing.items) {
        if (i.kind !== "EXTRA" || !i.unitPrice) continue;
        extraPrices.set(i.purchaseId, i.unitPrice);
        extrasSum = extrasSum.add(i.unitPrice.mul(i.quantity));
      }
      const oldSet = existing.assets[0];
      // events booked before set prices were stored: work it out from the old total
      const derived = existing.rentTotalPrice.add(existing.discount).sub(extrasSum);
      const keep: Keep = {
        setId: oldSet?.assetId ?? null,
        setPrice: oldSet ? (oldSet.price ?? (derived.gte(0) ? derived : null)) : null,
        extraPrices,
      };

      const plan = await planEvent(tx, d, eventNo, keep);
      const money = computeMoney(d, plan.setPrice, plan.extrasTotal);

      // replace the items with what the form now says
      await tx.eventItem.deleteMany({ where: { eventNo } });
      await tx.eventAsset.deleteMany({ where: { eventNo } });
      await tx.event.update({
        where: { eventNo },
        data: {
          ...eventFields(d, money),
          assets: plan.setId
            ? { create: [{ assetId: plan.setId, quantity: 1, price: plan.setPrice }] }
            : undefined,
          items: { create: plan.rows },
        },
      });
    });
  } catch (e) {
    if (e instanceof UserError) return { error: e.message };
    console.error("updateEvent failed:", e);
    return { error: "Could not save the changes. Please try again." };
  }

  revalidatePath("/events");
  revalidatePath(`/events/${eventNo}`);

  // Keep Google Calendar in step; the customer receives the updated invite
  const sync = await updateEventInCalendar(eventNo);
  if ("error" in sync) {
    redirect(`/events/${eventNo}?calendar=failed&msg=${encodeURIComponent(sync.error.slice(0, 300))}`);
  }
  redirect(`/events/${eventNo}?calendar=${sync.updated ? "updated" : "saved"}`);
}

// ─────────────────────────────────────────────
// Retry adding a saved event to Google Calendar
// ─────────────────────────────────────────────
export async function retryCalendarSync(eventNo: number): Promise<{ ok?: boolean; error?: string }> {
  const session = await auth();
  if (!session) return { error: "You are not signed in." };
  if (!Number.isInteger(eventNo) || eventNo < 1) return { error: "Invalid event." };

  const result = await syncEventToCalendar(eventNo);
  revalidatePath(`/events/${eventNo}`);
  revalidatePath("/events");
  if ("error" in result) return { error: result.error };
  return { ok: true };
}
