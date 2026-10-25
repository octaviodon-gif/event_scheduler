const pad = (n: number) => String(n).padStart(2, "0");

export const hhmmToMinutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

// "14:00" + 300 -> "19:00". Returns null if the result would be at or after midnight.
export function addMinutes(hhmm: string, minutes: number): string | null {
  const total = hhmmToMinutes(hhmm) + minutes;
  if (total >= 24 * 60) return null;
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}
