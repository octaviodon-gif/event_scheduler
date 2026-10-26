import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatEventNo, mapsUrl, toDateString, toTimeString, wazeUrl } from "@/lib/events";
import { getSettings } from "@/lib/settings";
import CalendarRetryButton from "./calendar-retry";

export const instant = false;

export default async function EventPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventNo: string }>;
  searchParams: Promise<{ calendar?: string; msg?: string }>;
}) {
  const s = await getSettings();
  const { eventNo } = await params;
  const { calendar, msg } = await searchParams;

  const n = Number(eventNo);
  if (!Number.isInteger(n) || n < 1) notFound();

  const ev = await prisma.event.findUnique({
    where: { eventNo: n },
    include: {
      assets: { include: { asset: true } },
      items: { include: { purchase: true } },
    },
  });
  if (!ev) notFound();

  const setItems = ev.items.filter((i) => i.kind !== "EXTRA");
  const extras = ev.items.filter((i) => i.kind === "EXTRA");
  const row = "flex justify-between gap-4 py-1";

  return (
    <main className="mx-auto max-w-3xl p-6">
      <Link href="/events" className="text-sm text-neutral-500 hover:underline">
        ← Events
      </Link>
      <div className="mt-2 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">{formatEventNo(ev.eventNo, s.eventPrefix)}</h1>
        <Link
          href={`/events/${ev.eventNo}/edit`}
          className="rounded-md border border-neutral-300 px-3 py-1 text-sm hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-900"
        >
          Edit event
        </Link>
      </div>
      <p className="text-sm text-neutral-500">
        {toDateString(ev.date)} · {toTimeString(ev.startTime)} – {toTimeString(ev.endTime)}
      </p>

      {/* Google Calendar status */}
      {calendar === "ok" && ev.googleEventId && (
        <p className="mt-4 rounded-md bg-green-100 p-3 text-sm text-green-800">
          Event scheduled and added to your Google Calendar
          {ev.customerEmail ? `. The invite was sent to ${ev.customerEmail}.` : "."}
        </p>
      )}
      {(calendar === "updated" || calendar === "saved") && (
        <p className="mt-4 rounded-md bg-green-100 p-3 text-sm text-green-800">
          {calendar === "updated"
            ? `Changes saved and your Google Calendar event was updated${ev.customerEmail ? `. ${ev.customerEmail} received the update.` : "."}`
            : "Changes saved."}
        </p>
      )}
      {!ev.googleEventId && (
        <div className="mt-4 space-y-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <p>
            <strong>The event is saved, but it is not in Google Calendar yet.</strong>
            {calendar === "failed" && msg ? ` Google said: ${msg}` : ""}
          </p>
          <CalendarRetryButton eventNo={ev.eventNo} />
        </div>
      )}

      <section className="mt-6 rounded-xl border border-neutral-300 p-5 dark:border-neutral-700">
        <h2 className="font-medium">Customer</h2>
        <p className="mt-2 text-sm">{ev.customerName}</p>
        <p className="text-sm">
          <a href={`tel:${ev.customerPhone}`} className="hover:underline">
            {ev.customerPhone}
          </a>
        </p>
        {ev.customerEmail && (
          <p className="text-sm">
            <a href={`mailto:${ev.customerEmail}`} className="hover:underline">
              {ev.customerEmail}
            </a>
          </p>
        )}

        <h2 className="mt-5 font-medium">Address</h2>
        <p className="mt-2 text-sm">
          <a
            href={mapsUrl(ev.eventAddress)}
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            {ev.eventAddress}
          </a>
        </p>
        <div className="mt-2 flex gap-2">
          <a
            href={mapsUrl(ev.eventAddress)}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md border border-neutral-300 px-3 py-1 text-sm hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-900"
          >
            Open in Google Maps
          </a>
          <a
            href={wazeUrl(ev.eventAddress)}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md border border-neutral-300 px-3 py-1 text-sm hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-900"
          >
            Open in Waze
          </a>
        </div>

        {ev.notes && (
          <>
            <h2 className="mt-5 font-medium">Notes</h2>
            <p className="mt-2 whitespace-pre-line text-sm">{ev.notes}</p>
          </>
        )}
      </section>

      <section className="mt-4 rounded-xl border border-neutral-300 p-5 dark:border-neutral-700">
        <h2 className="font-medium">Items</h2>
        {ev.assets.map((a) => (
          <p key={a.assetId} className="mt-2 text-sm font-medium">
            {a.asset.assetName}
          </p>
        ))}
        {setItems.length > 0 && (
          <ul className="mt-1 text-sm">
            {setItems.map((i) => (
              <li key={`${i.purchaseId}-${i.kind}`}>
                {i.quantity} × {i.purchase.assetName}
              </li>
            ))}
          </ul>
        )}
        {extras.length > 0 && (
          <>
            <p className="mt-3 text-xs font-medium uppercase tracking-wide text-neutral-500">Extra rentals</p>
            <ul className="mt-1 text-sm">
              {extras.map((i) => (
                <li key={`${i.purchaseId}-${i.kind}`} className={row}>
                  <span>
                    {i.quantity} × {i.purchase.assetName}
                  </span>
                  <span>${((Number(i.unitPrice) || 0) * i.quantity).toFixed(2)}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section className="mt-4 rounded-xl border border-neutral-300 p-5 text-sm dark:border-neutral-700">
        <h2 className="font-medium">Payment</h2>
        <div className={row}>
          <span>Rent total</span>
          <span>${ev.rentTotalPrice.toFixed(2)}</span>
        </div>
        <div className={row}>
          <span>Discount</span>
          <span>${ev.discount.toFixed(2)}</span>
        </div>
        <div className={row}>
          <span>Down payment</span>
          <span>${ev.downPaymentAmount.toFixed(2)}</span>
        </div>
        <div className={`${row} font-medium`}>
          <span>Pending payment</span>
          <span>${ev.pendingPayment.toFixed(2)}</span>
        </div>
        <p className="mt-2 text-xs text-neutral-500">
          {ev.paymentComplete ? "Paid in full." : "Balance pending."}
        </p>
      </section>
    </main>
  );
}
