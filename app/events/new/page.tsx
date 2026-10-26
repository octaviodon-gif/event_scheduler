import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getEventCatalog } from "@/lib/event-catalog";
import { formatEventNo } from "@/lib/events";
import { getSettings } from "@/lib/settings";
import EventForm from "../event-form";

export const instant = false;

export default async function NewEventPage() {
  const [s, catalog, last] = await Promise.all([
    getSettings(),
    getEventCatalog(),
    prisma.event.aggregate({ _max: { eventNo: true } }),
  ]);

  const nextNo = formatEventNo((last._max.eventNo ?? 0) + 1, s.eventPrefix);

  return (
    <main className="mx-auto max-w-3xl p-6">
      <Link href="/events" className="text-sm text-neutral-500 hover:underline">
        ← Events
      </Link>
      <h1 className="mt-2 text-2xl font-semibold">Register Customer &amp; Event</h1>

      <section className="mt-6 rounded-xl border border-neutral-300 p-5 dark:border-neutral-700">
        <EventForm
          nextNo={nextNo}
          sets={catalog.sets}
          items={catalog.items}
          durationMinutes={s.durationMinutes}
        />
      </section>
    </main>
  );
}
