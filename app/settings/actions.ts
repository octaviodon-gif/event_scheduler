"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export type SettingsFormState = { ok?: boolean; error?: string; fieldErrors?: Record<string, string> };

const validTimezone = (tz: string) => {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

const schema = z.object({
  eventPrefix: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{1,10}$/, "Use 1 to 10 letters or numbers, no spaces"),
  businessName: z.string().trim().min(1, "Required").max(100, "Max 100 characters"),
  timezone: z.string().trim().refine(validTimezone, "Not a valid timezone, for example America/Mexico_City"),
  durationHours: z.coerce.number().int("Whole hours only").min(1, "At least 1 hour").max(23, "At most 23 hours"),
  bufferMinutes: z.coerce.number().int("Whole minutes only").min(0, "0 or more").max(600, "At most 600"),
});

export async function saveSettings(
  _prev: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  const session = await auth();
  if (!session) return { error: "You are not signed in." };

  const parsed = schema.safeParse({
    eventPrefix: formData.get("eventPrefix") ?? "",
    businessName: formData.get("businessName") ?? "",
    timezone: formData.get("timezone") ?? "",
    durationHours: formData.get("durationHours") ?? "",
    bufferMinutes: formData.get("bufferMinutes") ?? "",
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[String(issue.path[0] ?? "form")] ??= issue.message;
    }
    return { fieldErrors };
  }

  try {
    await prisma.setting.upsert({
      where: { id: 1 },
      create: { id: 1, ...parsed.data },
      update: parsed.data,
    });
  } catch (e) {
    console.error("saveSettings failed", e);
    return { error: "Could not save the settings. Please try again." };
  }

  revalidatePath("/", "layout");
  return { ok: true };
}
