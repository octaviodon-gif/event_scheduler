// Business settings (prefix, name, timezone, buffer, duration) live in lib/settings.ts

// 12 -> "BBCITOS-0012"
export function formatEventNo(n: number, prefix: string) {
  return `${prefix}-${String(n).padStart(4, "0")}`;
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
