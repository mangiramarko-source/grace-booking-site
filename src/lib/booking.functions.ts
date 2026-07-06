import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Africa/Nairobi is UTC+3 with no DST.
const NAIROBI_OFFSET_MIN = 180;
const SLOT_INTERVAL_MIN = 30;

function dateAtNairobiTime(dateStr: string, hhmm: string): Date {
  // dateStr: yyyy-mm-dd; hhmm: "HH:MM" or "HH:MM:SS"
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm] = hhmm.split(":").map(Number);
  return new Date(Date.UTC(y, m - 1, d, hh, mm) - NAIROBI_OFFSET_MIN * 60 * 1000);
}

export const getServices = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("services")
    .select("id, name, description, duration_minutes, price_cents, currency, sort_order")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
});

export const getAvailability = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({
      serviceId: z.string().uuid(),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: service, error: svcErr }, { data: blocked }] = await Promise.all([
      supabaseAdmin.from("services").select("id, duration_minutes").eq("id", data.serviceId).maybeSingle(),
      supabaseAdmin.from("blocked_dates").select("blocked_date").eq("blocked_date", data.date).maybeSingle(),
    ]);
    if (svcErr) throw new Error(svcErr.message);
    if (!service) throw new Error("Service not found");
    if (blocked) return { slots: [] as string[], reason: "blocked" as const };

    // day_of_week using Nairobi date
    const [y, m, d] = data.date.split("-").map(Number);
    const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0..6 (Sun..Sat); date is a calendar day so UTC works
    const { data: hours } = await supabaseAdmin
      .from("business_hours").select("is_open, open_time, close_time").eq("day_of_week", dow).maybeSingle();
    if (!hours || !hours.is_open) return { slots: [], reason: "closed" as const };

    const dayStart = dateAtNairobiTime(data.date, hours.open_time as unknown as string);
    const dayEnd = dateAtNairobiTime(data.date, hours.close_time as unknown as string);

    // existing confirmed appointments overlapping this day
    const { data: appts, error: aerr } = await supabaseAdmin
      .from("appointments")
      .select("starts_at, ends_at, status")
      .eq("status", "confirmed")
      .gte("ends_at", dayStart.toISOString())
      .lte("starts_at", dayEnd.toISOString());
    if (aerr) throw new Error(aerr.message);

    const busy = (appts ?? []).map((a) => ({ start: new Date(a.starts_at).getTime(), end: new Date(a.ends_at).getTime() }));
    const durationMs = service.duration_minutes * 60 * 1000;
    const now = Date.now();

    const slots: string[] = [];
    for (let t = dayStart.getTime(); t + durationMs <= dayEnd.getTime(); t += SLOT_INTERVAL_MIN * 60 * 1000) {
      if (t < now + 30 * 60 * 1000) continue; // require at least 30min lead time
      const slotEnd = t + durationMs;
      const overlaps = busy.some((b) => b.start < slotEnd && b.end > t);
      if (!overlaps) slots.push(new Date(t).toISOString());
    }
    return { slots, reason: null };
  });

export const createBooking = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({
      serviceId: z.string().uuid(),
      startsAt: z.string().datetime(),
      customerName: z.string().trim().min(1).max(120),
      customerEmail: z.string().trim().email().max(255),
      customerPhone: z.string().trim().max(40).optional().nullable(),
      notes: z.string().trim().max(1000).optional().nullable(),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: service, error: svcErr } = await supabaseAdmin
      .from("services").select("id, name, duration_minutes").eq("id", data.serviceId).maybeSingle();
    if (svcErr) throw new Error(svcErr.message);
    if (!service) throw new Error("Service not found");

    const startsAt = new Date(data.startsAt);
    if (Number.isNaN(startsAt.getTime())) throw new Error("Invalid start time");
    if (startsAt.getTime() < Date.now()) throw new Error("Cannot book in the past");
    const endsAt = new Date(startsAt.getTime() + service.duration_minutes * 60 * 1000);

    // Conflict check
    const { data: conflicts, error: cErr } = await supabaseAdmin
      .from("appointments")
      .select("id")
      .eq("status", "confirmed")
      .lt("starts_at", endsAt.toISOString())
      .gt("ends_at", startsAt.toISOString())
      .limit(1);
    if (cErr) throw new Error(cErr.message);
    if (conflicts && conflicts.length > 0) {
      throw new Error("Sorry — that time was just taken. Please pick another slot.");
    }

    const { data: inserted, error: iErr } = await supabaseAdmin
      .from("appointments")
      .insert({
        service_id: service.id,
        customer_name: data.customerName,
        customer_email: data.customerEmail,
        customer_phone: data.customerPhone ?? null,
        notes: data.notes ?? null,
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
      })
      .select("id, cancel_token, starts_at, ends_at")
      .single();
    if (iErr) throw new Error(iErr.message);

    // Sync to Google Calendar (best-effort; failure does not block booking)
    try {
      const { createCalendarEvent } = await import("@/lib/google-calendar.server");
      const eventId = await createCalendarEvent({
        summary: `${service.name} — ${data.customerName}`,
        description: [
          `Service: ${service.name}`,
          `Client: ${data.customerName}`,
          `Email: ${data.customerEmail}`,
          data.customerPhone ? `Phone: ${data.customerPhone}` : null,
          data.notes ? `Notes: ${data.notes}` : null,
        ].filter(Boolean).join("\n"),
        startsAt: inserted.starts_at,
        endsAt: inserted.ends_at,
        attendeeEmail: data.customerEmail,
        attendeeName: data.customerName,
        status: "confirmed",
      });
      await supabaseAdmin.from("appointments").update({
        google_event_id: eventId ?? null,
        gcal_sync_status: eventId ? "created" : "failed",
        gcal_sync_error: eventId ? null : "Calendar API returned no event id",
        gcal_synced_at: new Date().toISOString(),
      } as never).eq("id", inserted.id);
    } catch (e) {
      console.error("[booking] gcal sync failed", e);
      await supabaseAdmin.from("appointments").update({
        gcal_sync_status: "failed",
        gcal_sync_error: e instanceof Error ? e.message : String(e),
      } as never).eq("id", inserted.id);
    }

    return {
      id: inserted.id,
      cancelToken: inserted.cancel_token,
      startsAt: inserted.starts_at,
      endsAt: inserted.ends_at,
      serviceName: service.name,
    };
  });


export const getBookingByToken = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ token: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: appt, error } = await supabaseAdmin
      .from("appointments")
      .select("id, customer_name, customer_email, starts_at, ends_at, status, notes, service_id, services(name, duration_minutes)")
      .eq("cancel_token", data.token)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!appt) return null;
    return {
      id: appt.id,
      customerName: appt.customer_name,
      customerEmail: appt.customer_email,
      startsAt: appt.starts_at,
      endsAt: appt.ends_at,
      status: appt.status,
      notes: appt.notes,
      serviceId: appt.service_id,
      // @ts-ignore - relation
      serviceName: appt.services?.name as string,
      // @ts-ignore
      durationMinutes: appt.services?.duration_minutes as number,
    };
  });

export const cancelBooking = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ token: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: appt } = await supabaseAdmin
      .from("appointments")
      .select("id, google_event_id")
      .eq("cancel_token", data.token)
      .maybeSingle();
    const { error } = await supabaseAdmin
      .from("appointments")
      .update({ status: "cancelled" })
      .eq("cancel_token", data.token);
    if (error) throw new Error(error.message);

    if (appt?.google_event_id) {
      try {
        const { cancelCalendarEvent } = await import("@/lib/google-calendar.server");
        await cancelCalendarEvent(appt.google_event_id);
        await supabaseAdmin.from("appointments").update({
          gcal_sync_status: "cancelled",
          gcal_sync_error: null,
          gcal_synced_at: new Date().toISOString(),
        } as never).eq("id", appt.id);
      } catch (e) {
        console.error("[booking] gcal cancel failed", e);
        await supabaseAdmin.from("appointments").update({
          gcal_sync_status: "failed",
          gcal_sync_error: e instanceof Error ? e.message : String(e),
        } as never).eq("id", appt.id);
      }
    }
    return { ok: true };
  });


export const rescheduleBooking = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({
      token: z.string().uuid(),
      startsAt: z.string().datetime(),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: appt, error } = await supabaseAdmin
      .from("appointments")
      .select("id, service_id, status, google_event_id, customer_name, customer_email, services(name, duration_minutes)")
      .eq("cancel_token", data.token)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!appt) throw new Error("Booking not found");
    if (appt.status === "cancelled") throw new Error("This booking is cancelled");

    // @ts-ignore
    const duration: number = appt.services?.duration_minutes;
    // @ts-ignore
    const serviceName: string = appt.services?.name;
    const startsAt = new Date(data.startsAt);
    const endsAt = new Date(startsAt.getTime() + duration * 60 * 1000);
    if (startsAt.getTime() < Date.now()) throw new Error("Cannot reschedule to the past");

    const { data: conflicts, error: cErr } = await supabaseAdmin
      .from("appointments")
      .select("id")
      .eq("status", "confirmed")
      .neq("id", appt.id)
      .lt("starts_at", endsAt.toISOString())
      .gt("ends_at", startsAt.toISOString())
      .limit(1);
    if (cErr) throw new Error(cErr.message);
    if (conflicts && conflicts.length > 0) throw new Error("That time was just taken. Please pick another.");

    const { error: uErr } = await supabaseAdmin
      .from("appointments")
      .update({ starts_at: startsAt.toISOString(), ends_at: endsAt.toISOString() })
      .eq("id", appt.id);
    if (uErr) throw new Error(uErr.message);

    if (appt.google_event_id) {
      try {
        const { updateCalendarEvent } = await import("@/lib/google-calendar.server");
        await updateCalendarEvent(appt.google_event_id, {
          summary: `${serviceName} — ${appt.customer_name}`,
          startsAt: startsAt.toISOString(),
          endsAt: endsAt.toISOString(),
          attendeeEmail: appt.customer_email,
          attendeeName: appt.customer_name,
          status: "confirmed",
        });
        await supabaseAdmin.from("appointments").update({
          gcal_sync_status: "updated",
          gcal_sync_error: null,
          gcal_synced_at: new Date().toISOString(),
        } as never).eq("id", appt.id);
      } catch (e) {
        console.error("[booking] gcal reschedule failed", e);
        await supabaseAdmin.from("appointments").update({
          gcal_sync_status: "failed",
          gcal_sync_error: e instanceof Error ? e.message : String(e),
        } as never).eq("id", appt.id);
      }
    }
    return { ok: true, startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString() };
  });

