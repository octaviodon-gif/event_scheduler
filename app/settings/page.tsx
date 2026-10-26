import Link from "next/link";
import { getSettings } from "@/lib/settings";
import SettingsForm from "./settings-form";

export const instant = false;

export default async function SettingsPage() {
  const s = await getSettings();

  return (
    <main className="mx-auto w-full max-w-3xl p-6">
      <Link href="/" className="text-sm text-neutral-500 hover:underline">
        ← Dashboard
      </Link>
      <h1 className="mt-2 text-2xl font-semibold">Business settings</h1>

      <section className="mt-6 rounded-xl border border-neutral-300 p-5 dark:border-neutral-700">
        <SettingsForm
          values={{
            eventPrefix: s.eventPrefix,
            businessName: s.businessName,
            timezone: s.timezone,
            durationHours: s.durationHours,
            bufferMinutes: s.bufferMinutes,
          }}
        />
      </section>
    </main>
  );
}
