import Link from "next/link";
import { getSettings } from "@/lib/settings";

export const instant = false;

// Public homepage (Google asks for one when an app is published)
export default async function AboutPage() {
  const s = await getSettings();
  const name = s.businessName || "Event Scheduler";

  return (
    <main className="mx-auto w-full max-w-2xl p-6">
      <h1 className="text-2xl font-semibold">{name}</h1>
      <p className="mt-4 text-sm">
        This is the private scheduling tool of {name}. It is used by the business to manage rental inventory,
        rentable sets and customer events, and to add each event to the business owner&apos;s Google Calendar
        with an invitation for the customer.
      </p>
      <p className="mt-3 text-sm">
        The app is not open to the public. Only the business owner and people they authorize can sign in.
      </p>
      <div className="mt-6 flex flex-wrap gap-4 text-sm">
        <Link href="/login" className="underline">
          Sign in
        </Link>
        <Link href="/privacy" className="underline">
          Privacy policy
        </Link>
      </div>
    </main>
  );
}
