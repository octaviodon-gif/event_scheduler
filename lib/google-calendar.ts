import { BUSINESS_NAME, EVENT_TIMEZONE } from "@/lib/events";

export type CalendarEventInput = {
  eventLabel: string; // e.g. BBCITOS-0001
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  address: string;
  notes: string | null;
  date: string; // YYYY-MM-DD
  start: string; // HH:MM
  end: string; // HH:MM
  items: { name: string; quantity: number }[]; // set name first, then its items and extras
  downPayment: string; // already formatted, e.g. "690.00"
  discount: string;
  pending: string;
  total: string;
};

// The calendar text is in Spanish, like the events the business already creates by hand
export function buildTitle(i: CalendarEventInput) {
  return [BUSINESS_NAME, i.customerName, i.customerPhone].filter(Boolean).join(" – ");
}

export function buildDescription(i: CalendarEventInput) {
  const lines = [
    `Evento: ${i.eventLabel}`,
    `Cliente: ${i.customerName}`,
    `Teléfono: ${i.customerPhone}`,
    ...(i.customerEmail ? [`Correo: ${i.customerEmail}`] : []),
    `Dirección: ${i.address}`,
    `Fecha: ${i.date}`,
    `Horario: ${i.start} – ${i.end}`,
    "",
    "📦 Mobiliario:",
    ...i.items.map((it) => `• ${it.name}${it.quantity > 1 ? ` (${it.quantity})` : ""}`),
    "",
    ...(i.notes ? [`Notas: ${i.notes}`] : []),
    `💰 Anticipo = $${i.downPayment}`,
    `💰 Descuentos = $${i.discount}`,
    `💰 Pago Pendiente = $${i.pending}`,
    `💰 Renta Total = $${i.total}`,
  ];
  return lines.join("\n");
}

function buildBody(input: CalendarEventInput) {
  return {
    summary: buildTitle(input),
    location: input.address, // Google Calendar turns this into a Maps link
    description: buildDescription(input),
    start: { dateTime: `${input.date}T${input.start}:00`, timeZone: EVENT_TIMEZONE },
    end: { dateTime: `${input.date}T${input.end}:00`, timeZone: EVENT_TIMEZONE },
    reminders: {
      useDefault: false,
      overrides: [
        { method: "popup", minutes: 120 }, // 2 hours before
        { method: "popup", minutes: 1440 }, // 1 day before
      ],
    },
  };
}

const API = "https://www.googleapis.com/calendar/v3/calendars/primary/events";

// Creates the event in the signed-in user's primary calendar and emails the invite to the customer
export async function insertCalendarEvent(
  accessToken: string,
  input: CalendarEventInput,
): Promise<{ id: string } | { error: string }> {
  const body = {
    ...buildBody(input),
    ...(input.customerEmail ? { attendees: [{ email: input.customerEmail }] } : {}),
  };

  try {
    const res = await fetch(`${API}?sendUpdates=all`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { error: data?.error?.message ?? `Google Calendar answered with status ${res.status}.` };
    }
    return { id: String(data.id) };
  } catch {
    return { error: "Could not reach Google Calendar. Check your connection and try again." };
  }
}

// Updates an event that is already in the calendar; the customer gets the updated invite by email.
// `gone` is true when the event no longer exists in the calendar (it was deleted there).
export async function patchCalendarEvent(
  accessToken: string,
  googleEventId: string,
  input: CalendarEventInput,
): Promise<{ ok: true } | { error: string; gone?: boolean }> {
  const body = {
    ...buildBody(input),
    attendees: input.customerEmail ? [{ email: input.customerEmail }] : [],
  };

  try {
    const res = await fetch(`${API}/${encodeURIComponent(googleEventId)}?sendUpdates=all`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) return { ok: true };
    const data = await res.json().catch(() => ({}));
    if (res.status === 404 || res.status === 410) {
      return { error: "The event was deleted from your Google Calendar.", gone: true };
    }
    return { error: data?.error?.message ?? `Google Calendar answered with status ${res.status}.` };
  } catch {
    return { error: "Could not reach Google Calendar. Check your connection and try again." };
  }
}
