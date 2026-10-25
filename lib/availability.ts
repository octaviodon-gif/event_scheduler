import type { Prisma } from "@/generated/prisma/client";
import { dateToDate, minutesOfDay } from "@/lib/events";

// Two time windows clash if they overlap, counting the buffer needed between events
export function timesOverlap(
  startA: number,
  endA: number,
  startB: number,
  endB: number,
  buffer: number,
) {
  return startA < endB + buffer && startB - buffer < endA;
}

// Free units of every completed purchase for a date and time window:
// units in service minus what other events already reserve at overlapping times
export async function freeUnitsByPurchase(
  tx: Prisma.TransactionClient,
  date: string, // YYYY-MM-DD
  startMin: number,
  endMin: number,
  buffer: number,
  excludeEventNo?: number, // ignore this event's own reservations (used when editing it)
) {
  const [purchases, events] = await Promise.all([
    tx.purchase.findMany({ where: { purchaseStatus: "COMPLETED" } }),
    tx.event.findMany({
      where: {
        date: dateToDate(date),
        ...(excludeEventNo ? { eventNo: { not: excludeEventNo } } : {}),
      },
      include: { items: true },
    }),
  ]);

  const reserved = new Map<string, number>();
  for (const ev of events) {
    if (!timesOverlap(startMin, endMin, minutesOfDay(ev.startTime), minutesOfDay(ev.endTime), buffer)) {
      continue;
    }
    for (const it of ev.items) {
      reserved.set(it.purchaseId, (reserved.get(it.purchaseId) ?? 0) + it.quantity);
    }
  }

  const free = new Map<string, number>();
  for (const p of purchases) {
    const usable = p.quantity - p.unavailableQuantity - (reserved.get(p.purchaseId) ?? 0);
    free.set(p.purchaseId, Math.max(usable, 0));
  }
  return free;
}
