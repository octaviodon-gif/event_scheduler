import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { formatEventNo, toDateString, toTimeString } from "@/lib/events";
import {
  insertCalendarEvent,
  patchCalendarEvent,
  type CalendarEventInput,
} from "@/lib/google-calendar";

async function getToken(): Promise<{ token: string } | { error: string }> {
  const session = await auth();
  if (!session) return { error: "You are not signed in." };
  if (session.error || !session.accessToken) {
    return {
      error:
        "The app has no permission to use your Google Calendar yet. Sign out, sign in again and accept the calendar permission, then retry.",
    };
  }
  return { token: session.accessToken };
}

async function loadEvent(
  eventNo: number,
): Promise<{ googleEventId: string | null; input: CalendarEventInput } | { error: string }> {
  const ev = await prisma.event.findUnique({
    where: { eventNo },
    include: {
      assets: { include: { asset: true } },
      items: { include: { purchase: true } },
    },
  });
  if (!ev) return { error: "Event not found." };
  const s = await getSettings();

  const order = { SET_FIXED: 0, SET_PICK: 1, EXTRA: 2 } as const;
  const items = [
    ...ev.assets.map((a) => ({ name: a.asset.assetName, quantity: 1 })),
    ...[...ev.items]
      .sort((a, b) => order[a.kind] - order[b.kind] || a.purchase.assetName.localeCompare(b.purchase.assetName))
      .map((i) => ({ name: i.purchase.assetName, quantity: i.quantity })),
  ];

  return {
    googleEventId: ev.googleEventId,
    input: {
      eventLabel: formatEventNo(ev.eventNo, s.eventPrefix),
      businessName: s.businessName,
      timezone: s.timezone,
      customerName: ev.customerName,
      customerPhone: ev.customerPhone,
      customerEmail: ev.customerEmail,
      address: ev.eventAddress,
      notes: ev.notes,
      date: toDateString(ev.date),
      start: toTimeString(ev.startTime),
      end: toTimeString(ev.endTime),
      items,
      downPayment: ev.downPaymentAmount.toFixed(2),
      discount: ev.discount.toFixed(2),
      pending: ev.pendingPayment.toFixed(2),
      total: ev.rentTotalPrice.toFixed(2),
    },
  };
}

// Adds a saved event to the signed-in owner's Google Calendar and invites the customer.
// The event stays saved in the database even if this fails; it can be retried from the event page.
export async function syncEventToCalendar(eventNo: number): Promise<{ ok: true } | { error: string }> {
  const t = await getToken();
  if ("error" in t) return t;

  const loaded = await loadEvent(eventNo);
  if ("error" in loaded) return loaded;
  if (loaded.googleEventId) return { ok: true };

  const result = await insertCalendarEvent(t.token, loaded.input);
  if ("error" in result) return { error: result.error };

  await prisma.event.update({ where: { eventNo }, data: { googleEventId: result.id } });
  return { ok: true };
}

// After an event is edited: update its Google Calendar event (and resend the invite to the customer).
// An event that is not in the calendar yet is left alone; "Send invite" adds it.
export async function updateEventInCalendar(
  eventNo: number,
): Promise<{ ok: true; updated: boolean } | { error: string }> {
  const loaded = await loadEvent(eventNo);
  if ("error" in loaded) return loaded;
  if (!loaded.googleEventId) return { ok: true, updated: false };

  const t = await getToken();
  if ("error" in t) return t;

  const result = await patchCalendarEvent(t.token, loaded.googleEventId, loaded.input);
  if ("error" in result) {
    if (result.gone) {
      // it no longer exists in the calendar: forget the old id so "Send invite" can add it again
      await prisma.event.update({ where: { eventNo }, data: { googleEventId: null } });
      return { error: `${result.error} The changes are saved here; use "Send invite" to add it again.` };
    }
    return { error: result.error };
  }
  return { ok: true, updated: true };
}
