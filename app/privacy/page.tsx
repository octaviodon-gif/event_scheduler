import Link from "next/link";
import { getSettings } from "@/lib/settings";

export const instant = false;

// Public privacy policy (Google asks for one when an app is published)
export default async function PrivacyPage() {
  const s = await getSettings();
  const name = s.businessName || "Event Scheduler";
  const contact = process.env.CONTACT_EMAIL?.trim();

  return (
    <main className="mx-auto w-full max-w-2xl p-6">
      <Link href="/about" className="text-sm text-neutral-500 hover:underline">
        ← {name}
      </Link>
      <h1 className="mt-2 text-2xl font-semibold">Privacy policy</h1>
      <p className="mt-1 text-xs text-neutral-500">Last updated: November 2026</p>

      <div className="mt-6 space-y-5 text-sm">
        <section>
          <h2 className="font-medium">What this app is</h2>
          <p className="mt-1">
            {name} uses this private tool to manage rental inventory and customer events. It is used only by
            the business owner and people the owner authorizes.
          </p>
        </section>

        <section>
          <h2 className="font-medium">Information we handle</h2>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            <li>
              <strong>Google account information</strong> (name and email address) of the people who sign in,
              used only to confirm they are allowed to use the app.
            </li>
            <li>
              <strong>Google Calendar access.</strong> When a signed-in user schedules or edits an event, the
              app creates or updates that event in the user&apos;s own Google Calendar and sends the invitation
              to the customer&apos;s email address.
            </li>
            <li>
              <strong>Customer details</strong> entered by the business (name, phone number, email, event
              address and notes), stored so events can be scheduled and managed.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="font-medium">How the information is used</h2>
          <p className="mt-1">
            Only to schedule events, send calendar invitations and run the rental business. We do not sell
            personal information, use it for advertising, or share it with third parties, except the service
            providers needed to run the app (hosting and database) and Google itself, to create calendar
            events.
          </p>
        </section>

        <section>
          <h2 className="font-medium">Google API Services User Data Policy</h2>
          <p className="mt-1">
            The app&apos;s use and transfer of information received from Google APIs adheres to the Google API
            Services User Data Policy, including the Limited Use requirements. Calendar data is used only to
            create and update the events described above.
          </p>
        </section>

        <section>
          <h2 className="font-medium">Storage and retention</h2>
          <p className="mt-1">
            Data is stored in a private database and is kept for as long as the business needs it. A person
            can ask for their information to be corrected or deleted using the contact below. Signed-in users
            can also remove the app&apos;s access to their Google account at any time from their Google
            account&apos;s security settings.
          </p>
        </section>

        <section>
          <h2 className="font-medium">Contact</h2>
          <p className="mt-1">
            {contact ? (
              <>
                Questions or requests: <a href={`mailto:${contact}`} className="underline">{contact}</a>
              </>
            ) : (
              <>Questions or requests: contact {name} directly.</>
            )}
          </p>
        </section>
      </div>
    </main>
  );
}
