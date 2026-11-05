import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { endsNextDay, formatEventNo, toDateString, toTimeString } from "@/lib/events";
import { getSettings } from "@/lib/settings";
import EventList from "./event-list";

export const instant = false;

export default async function EventsPage() {
  const s = await getSettings();
  const events = await prisma.event.findMany({
    include: { assets: { include: { asset: true } } },
    orderBy: [{ date: "desc" }, { startTime: "desc" }],
    take: 1000,
  });

  return (
    <main className="mx-auto w-full max-w-5xl p-6">
      <Link href="/" className="text-sm text-neutral-500 hover:underline">
        ← Dashboard
      </Link>
      <div className="mt-2 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Events</h1>
        <Link
          href="/events/new"
          className="rounded-md bg-brand px-4 py-2 text-sm text-white hover:opacity-80"
        >
          Register Customer &amp; Event
        </Link>
      </div>

      {events.length === 0 ? (
        <p className="mt-6 text-sm text-neutral-500">No events yet.</p>
      ) : (
        <EventList
          rows={events.map((ev) => ({
            eventNo: ev.eventNo,
            label: formatEventNo(ev.eventNo, s.eventPrefix),
            date: toDateString(ev.date),
            time: `${toTimeString(ev.startTime)} – ${toTimeString(ev.endTime)}${
              endsNextDay(ev.startTime, ev.endTime) ? " (+1)" : ""
            }`,
            endHM: toTimeString(ev.endTime),
            nextDay: endsNextDay(ev.startTime, ev.endTime),
            customer: ev.customerName,
            sets: ev.assets.map((a) => a.asset.assetName).join(", "),
            total: Number(ev.rentTotalPrice),
            pending: Number(ev.pendingPayment),
            invited: Boolean(ev.googleEventId),
          }))}
        />
      )}
    </main>
  );
}
