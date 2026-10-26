import { cache } from "react";
import { prisma } from "@/lib/prisma";

export type Settings = {
  eventPrefix: string; // BBCITOS
  businessName: string;
  timezone: string; // IANA name, e.g. America/Mexico_City
  bufferMinutes: number; // minutes needed between events (0 = none)
  durationHours: number; // every event lasts this long
  durationMinutes: number;
};

// Used until the owner saves the Settings page for the first time
function fromEnv(): Settings {
  const durationHours = Math.max(Number.parseInt(process.env.EVENT_DURATION_HOURS ?? "5", 10) || 5, 1);
  return {
    eventPrefix: process.env.EVENT_NUMBER_PREFIX?.trim() || "EVT",
    businessName: process.env.BUSINESS_NAME?.trim() || "",
    timezone: process.env.EVENT_TIMEZONE?.trim() || "UTC",
    bufferMinutes: Math.max(Number.parseInt(process.env.EVENT_BUFFER_MINUTES ?? "0", 10) || 0, 0),
    durationHours,
    durationMinutes: durationHours * 60,
  };
}

// The saved settings, or the .env values when nothing has been saved yet
export const getSettings = cache(async (): Promise<Settings> => {
  const row = await prisma.setting.findUnique({ where: { id: 1 } });
  if (!row) return fromEnv();
  return {
    eventPrefix: row.eventPrefix,
    businessName: row.businessName,
    timezone: row.timezone,
    bufferMinutes: row.bufferMinutes,
    durationHours: row.durationHours,
    durationMinutes: row.durationHours * 60,
  };
});
