// Business settings come from .env so every business can set its own
export const EVENT_PREFIX = process.env.EVENT_NUMBER_PREFIX?.trim() || "EVT";
export const BUSINESS_NAME = process.env.BUSINESS_NAME?.trim() || "";
export const EVENT_TIMEZONE = process.env.EVENT_TIMEZONE?.trim() || "UTC";
// Minutes needed before and after an event for delivery, setup and pickup (0 = none)
export const EVENT_BUFFER_MINUTES = Math.max(
  Number.parseInt(process.env.EVENT_BUFFER_MINUTES ?? "0", 10) || 0,
  0,
);

// How long every event lasts (the end time is calculated from the start time)
export const EVENT_DURATION_MINUTES =
  Math.max(Number.parseInt(process.env.EVENT_DURATION_HOURS ?? "5", 10) || 5, 1) * 60;

// 12 -> "BBCITOS-0012"
export function formatEventNo(n: number) {
  return `${EVENT_PREFIX}-${String(n).padStart(4, "0")}`;
}

export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isRealDate(value: string) {
  if (!DATE_RE.test(value)) return false;
  const d = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

// Database date/time columns <-> "YYYY-MM-DD" / "HH:MM" strings (always handled as UTC, no shifting)
export const dateToDate = (v: string) => new Date(`${v}T00:00:00.000Z`);
export const timeToDate = (v: string) => new Date(`1970-01-01T${v}:00.000Z`);
export const toDateString = (d: Date) => d.toISOString().slice(0, 10);
export const toTimeString = (d: Date) => d.toISOString().slice(11, 16);

export const timeToMinutes = (v: string) => Number(v.slice(0, 2)) * 60 + Number(v.slice(3, 5));
export const minutesOfDay = (d: Date) => d.getUTCHours() * 60 + d.getUTCMinutes();

// The business copies addresses from Google Maps, so these open straight in a map or Waze
export const mapsUrl = (address: string) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
export const wazeUrl = (address: string) =>
  `https://waze.com/ul?q=${encodeURIComponent(address)}&navigate=yes`;
