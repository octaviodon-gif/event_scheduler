"use client";

import { startTransition, useActionState } from "react";
import { saveSettings, type SettingsFormState } from "./actions";

export type SettingsValues = {
  eventPrefix: string;
  businessName: string;
  timezone: string;
  durationHours: number;
  bufferMinutes: number;
};

const input =
  "w-full rounded-md border border-neutral-300 bg-transparent px-3 py-2 dark:border-neutral-700";

export default function SettingsForm({ values }: { values: SettingsValues }) {
  const [state, formAction, pending] = useActionState<SettingsFormState, FormData>(saveSettings, {});

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(() => formAction(fd));
  }

  const err = (name: string) =>
    state.fieldErrors?.[name] ? <p className="mt-1 text-xs text-red-600">{state.fieldErrors[name]}</p> : null;

  return (
    <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
      <label>
        <span className="text-sm">Business name</span>
        <input name="businessName" defaultValue={values.businessName} className={input} required maxLength={100} />
        <p className="mt-1 text-xs text-neutral-500">Shown in the title of every calendar event.</p>
        {err("businessName")}
      </label>

      <label>
        <span className="text-sm">Event number prefix</span>
        <input
          name="eventPrefix"
          defaultValue={values.eventPrefix}
          className={`${input} uppercase`}
          required
          maxLength={10}
        />
        <p className="mt-1 text-xs text-neutral-500">
          Letters and numbers only, like BBCITOS. Changing it renames the numbers of all events, old ones too
          (BBCITOS-0012 becomes NEWPREFIX-0012). The count itself never changes.
        </p>
        {err("eventPrefix")}
      </label>

      <label>
        <span className="text-sm">Event duration (hours)</span>
        <input
          name="durationHours"
          type="number"
          min={1}
          max={23}
          step={1}
          defaultValue={values.durationHours}
          className={input}
          required
        />
        <p className="mt-1 text-xs text-neutral-500">
          Applies to events you schedule or edit from now on. Saved events keep their end time until you edit them.
        </p>
        {err("durationHours")}
      </label>

      <label>
        <span className="text-sm">Minutes between events</span>
        <input
          name="bufferMinutes"
          type="number"
          min={0}
          max={600}
          step={5}
          defaultValue={values.bufferMinutes}
          className={input}
          required
        />
        <p className="mt-1 text-xs text-neutral-500">
          Time needed for delivery, setup and pickup before the same items can be rented again. 0 = none.
        </p>
        {err("bufferMinutes")}
      </label>

      <label className="sm:col-span-2">
        <span className="text-sm">Timezone</span>
        <input name="timezone" defaultValue={values.timezone} className={input} required maxLength={60} />
        <p className="mt-1 text-xs text-neutral-500">
          Used for Google Calendar. Guadalajara and Mexico City: America/Mexico_City.
        </p>
        {err("timezone")}
      </label>

      <div className="flex items-center justify-end gap-3 sm:col-span-2">
        {state.ok && <span className="text-sm text-green-700">Saved.</span>}
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-black px-4 py-2 text-white disabled:opacity-50 dark:bg-white dark:text-black"
        >
          {pending ? "Saving…" : "Save settings"}
        </button>
      </div>

      {state.error && <p className="text-sm text-red-600 sm:col-span-2">{state.error}</p>}
    </form>
  );
}
