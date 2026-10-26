import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatEventNo, toDateString, toTimeString } from "@/lib/events";
import { getSettings } from "@/lib/settings";
import CalendarRetryButton from "./[eventNo]/calendar-retry";

export const instant = false;

export default async function EventsPage() {
  const s = await getSettings();
  const events = await prisma.event.findMany({
    include: { assets: { include: { asset: true } } },
    orderBy: [{ date: "desc" }, { startTime: "desc" }],
    take: 200,
  });

  return (
    <main className="mx-auto max-w-5xl p-6">
      <Link href="/" className="text-sm text-neutral-500 hover:underline">
        ← Dashboard
      </Link>
      <div className="mt-2 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Events</h1>
        <Link
          href="/events/new"
          className="rounded-md bg-black px-4 py-2 text-sm text-white hover:opacity-80 dark:bg-white dark:text-black"
        >
          Register Customer &amp; Event
        </Link>
      </div>

      {events.length === 0 ? (
        <p className="mt-6 text-sm text-neutral-500">No events yet.</p>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-neutral-300 dark:border-neutral-700">
              <tr>
                <th className="py-2 pr-4">No.</th>
                <th className="py-2 pr-4">Date</th>
                <th className="py-2 pr-4">Time</th>
                <th className="py-2 pr-4">Customer</th>
                <th className="py-2 pr-4">Set</th>
                <th className="py-2 pr-4 text-right">Total</th>
                <th className="py-2 pr-4 text-right">Pending</th>
                <th className="py-2">Calendar</th>
              </tr>
            </thead>
            <tbody>
              {events.map((ev) => (
                <tr key={ev.eventNo} className="border-b border-neutral-200 dark:border-neutral-800">
                  <td className="py-2 pr-4">
                    <Link href={`/events/${ev.eventNo}`} className="font-medium hover:underline">
                      {formatEventNo(ev.eventNo, s.eventPrefix)}
                    </Link>
                  </td>
                  <td className="py-2 pr-4">{toDateString(ev.date)}</td>
                  <td className="py-2 pr-4">
                    {toTimeString(ev.startTime)} – {toTimeString(ev.endTime)}
                  </td>
                  <td className="py-2 pr-4">{ev.customerName}</td>
                  <td className="py-2 pr-4">{ev.assets.map((a) => a.asset.assetName).join(", ") || "—"}</td>
                  <td className="py-2 pr-4 text-right">${ev.rentTotalPrice.toFixed(2)}</td>
                  <td className="py-2 pr-4 text-right">${ev.pendingPayment.toFixed(2)}</td>
                  <td className="py-2">
                    {ev.googleEventId ? (
                      "Invite sent"
                    ) : (
                      <CalendarRetryButton eventNo={ev.eventNo} compact />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
