"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { retryCalendarSync } from "../actions";

// Adds a saved event to Google Calendar and emails the invite to the customer.
// `compact` is the small version used inside the events list.
export default function CalendarRetryButton({
  eventNo,
  compact = false,
}: {
  eventNo: number;
  compact?: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onClick() {
    setError(null);
    start(async () => {
      const result = await retryCalendarSync(eventNo);
      if (result.error) {
        setError(result.error);
        return;
      }
      if (compact) router.refresh();
      else router.replace(`/events/${eventNo}?calendar=ok`);
    });
  }

  return (
    <div>
      <button
        type="button"
        disabled={pending}
        onClick={onClick}
        className="rounded-md border border-neutral-300 px-3 py-1 text-sm hover:bg-neutral-100 disabled:opacity-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
      >
        {pending ? "Sending…" : compact ? "Send invite" : "Add to Google Calendar and send the invite"}
      </button>
      {error && <p className="mt-2 max-w-xs text-xs text-red-600">{error}</p>}
    </div>
  );
}
