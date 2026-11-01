const pad = (n: number) => String(n).padStart(2, "0");

export const hhmmToMinutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

// "14:00" + 300 -> "19:00". Past midnight it wraps: "22:00" + 300 -> "03:00" (the next day).
export function addMinutes(hhmm: string, minutes: number): string {
  const total = (hhmmToMinutes(hhmm) + minutes) % (24 * 60);
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}
