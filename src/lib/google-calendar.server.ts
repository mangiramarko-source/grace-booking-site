// Google Calendar sync helpers. Server-only.
// Uses the Lovable connector gateway for Google Calendar API v3.

const GATEWAY_BASE = "https://connector-gateway.lovable.dev/google_calendar/calendar/v3";
const CALENDAR_ID = "primary";

function authHeaders() {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const gcalKey = process.env.GOOGLE_CALENDAR_API_KEY;
  if (!lovableKey || !gcalKey) {
    throw new Error("Google Calendar connector not configured");
  }
  return {
    Authorization: `Bearer ${lovableKey}`,
    "X-Connection-Api-Key": gcalKey,
    "Content-Type": "application/json",
  };
}

export type CalendarEventInput = {
  summary: string;
  description?: string;
  startsAt: string; // ISO
  endsAt: string;   // ISO
  attendeeEmail?: string | null;
  attendeeName?: string | null;
  status?: "confirmed" | "cancelled";
};

function buildEventBody(input: CalendarEventInput) {
  const body: Record<string, unknown> = {
    summary: input.summary,
    description: input.description ?? "",
    start: { dateTime: new Date(input.startsAt).toISOString() },
    end: { dateTime: new Date(input.endsAt).toISOString() },
  };
  if (input.status) body.status = input.status;
  if (input.attendeeEmail) {
    body.attendees = [{ email: input.attendeeEmail, displayName: input.attendeeName ?? undefined }];
  }
  return body;
}

export async function createCalendarEvent(input: CalendarEventInput): Promise<string | null> {
  const res = await fetch(`${GATEWAY_BASE}/calendars/${encodeURIComponent(CALENDAR_ID)}/events`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(buildEventBody(input)),
  });
  if (!res.ok) {
    const body = await res.text();
    console.error("[gcal] create failed", res.status, body);
    throw new Error(`Calendar create failed [${res.status}]: ${body.slice(0, 300)}`);
  }
  const data = (await res.json()) as { id?: string };
  return data.id ?? null;
}

export async function updateCalendarEvent(eventId: string, input: CalendarEventInput): Promise<void> {
  const res = await fetch(
    `${GATEWAY_BASE}/calendars/${encodeURIComponent(CALENDAR_ID)}/events/${encodeURIComponent(eventId)}`,
    { method: "PATCH", headers: authHeaders(), body: JSON.stringify(buildEventBody(input)) },
  );
  if (!res.ok) {
    const body = await res.text();
    console.error("[gcal] update failed", res.status, body);
    throw new Error(`Calendar update failed [${res.status}]: ${body.slice(0, 300)}`);
  }
}

export async function cancelCalendarEvent(eventId: string): Promise<void> {
  const res = await fetch(
    `${GATEWAY_BASE}/calendars/${encodeURIComponent(CALENDAR_ID)}/events/${encodeURIComponent(eventId)}`,
    { method: "PATCH", headers: authHeaders(), body: JSON.stringify({ status: "cancelled" }) },
  );
  if (!res.ok) {
    const body = await res.text();
    console.error("[gcal] cancel failed", res.status, body);
    throw new Error(`Calendar cancel failed [${res.status}]: ${body.slice(0, 300)}`);
  }
}
