import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function assertAdmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("user_roles").select("id").eq("user_id", userId).eq("role", "admin").maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin role required");
}

// Bootstrap: if no admin exists, current user becomes admin.
export const claimAdminIfFirst = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count } = await supabaseAdmin
      .from("user_roles").select("id", { count: "exact", head: true }).eq("role", "admin");
    if ((count ?? 0) === 0) {
      await supabaseAdmin.from("user_roles").insert({ user_id: context.userId, role: "admin" });
      return { promoted: true, isAdmin: true };
    }
    const { data } = await supabaseAdmin
      .from("user_roles").select("id").eq("user_id", context.userId).eq("role", "admin").maybeSingle();
    return { promoted: false, isAdmin: !!data };
  });

export const adminListAppointments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("appointments")
      .select("id, customer_name, customer_email, customer_phone, notes, starts_at, ends_at, status, gcal_sync_status, gcal_sync_error, gcal_synced_at, google_event_id, services(name)")
      .order("starts_at", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []).map((a) => ({
      ...a,
      // @ts-ignore
      service_name: a.services?.name as string,
    }));
  });

export const adminListServices = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.from("services").select("*").order("sort_order");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const adminUpsertService = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      id: z.string().uuid().optional(),
      name: z.string().min(1).max(120),
      description: z.string().max(2000).optional().nullable(),
      duration_minutes: z.number().int().positive(),
      price_cents: z.number().int().nonnegative(),
      currency: z.string().default("KES"),
      sort_order: z.number().int().default(0),
      is_active: z.boolean().default(true),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.id) {
      const { error } = await supabaseAdmin.from("services").update(data).eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin.from("services").insert(data);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const adminDeleteService = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // soft-disable to keep historical fk integrity
    const { error } = await supabaseAdmin.from("services").update({ is_active: false }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminListHours = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.from("business_hours").select("*").order("day_of_week");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const adminUpdateHours = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      day_of_week: z.number().int().min(0).max(6),
      is_open: z.boolean(),
      open_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
      close_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("business_hours")
      .update({ is_open: data.is_open, open_time: data.open_time, close_time: data.close_time })
      .eq("day_of_week", data.day_of_week);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminListBlocked = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("blocked_dates").select("*").order("blocked_date", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const adminAddBlocked = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      blocked_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      reason: z.string().max(200).optional().nullable(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("blocked_dates").upsert({ blocked_date: data.blocked_date, reason: data.reason ?? null }, { onConflict: "blocked_date" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminRemoveBlocked = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("blocked_dates").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ===== Appointments management =====
export const adminUpdateAppointment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      id: z.string().uuid(),
      starts_at: z.string().datetime().optional(),
      service_id: z.string().uuid().optional(),
      customer_name: z.string().trim().min(1).max(120).optional(),
      customer_email: z.string().trim().email().max(255).optional(),
      customer_phone: z.string().trim().max(40).nullable().optional(),
      notes: z.string().trim().max(2000).nullable().optional(),
      status: z.enum(["confirmed", "cancelled", "completed"]).optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: Record<string, unknown> = {};
    if (data.customer_name !== undefined) patch.customer_name = data.customer_name;
    if (data.customer_email !== undefined) patch.customer_email = data.customer_email;
    if (data.customer_phone !== undefined) patch.customer_phone = data.customer_phone;
    if (data.notes !== undefined) patch.notes = data.notes;
    if (data.status !== undefined) patch.status = data.status;

    // If rescheduling or changing service we must recompute ends_at
    if (data.starts_at || data.service_id) {
      const { data: cur } = await supabaseAdmin
        .from("appointments").select("service_id, starts_at").eq("id", data.id).maybeSingle();
      if (!cur) throw new Error("Appointment not found");
      const svcId = data.service_id ?? cur.service_id;
      const { data: svc } = await supabaseAdmin
        .from("services").select("duration_minutes").eq("id", svcId).maybeSingle();
      if (!svc) throw new Error("Service not found");
      const startsAt = new Date(data.starts_at ?? cur.starts_at);
      const endsAt = new Date(startsAt.getTime() + svc.duration_minutes * 60 * 1000);
      patch.service_id = svcId;
      patch.starts_at = startsAt.toISOString();
      patch.ends_at = endsAt.toISOString();
    }

    const { error } = await supabaseAdmin.from("appointments").update(patch as never).eq("id", data.id);
    if (error) throw new Error(error.message);

    // Sync change to Google Calendar
    try {
      const { data: full } = await supabaseAdmin
        .from("appointments")
        .select("google_event_id, customer_name, customer_email, starts_at, ends_at, status, services(name)")
        .eq("id", data.id)
        .maybeSingle();
      if (full?.google_event_id) {
        // @ts-ignore
        const svcName: string = full.services?.name ?? "Appointment";
        if (full.status === "cancelled") {
          const { cancelCalendarEvent } = await import("@/lib/google-calendar.server");
          await cancelCalendarEvent(full.google_event_id);
          await supabaseAdmin.from("appointments").update({
            gcal_sync_status: "cancelled", gcal_sync_error: null, gcal_synced_at: new Date().toISOString(),
          } as never).eq("id", data.id);
        } else {
          const { updateCalendarEvent } = await import("@/lib/google-calendar.server");
          await updateCalendarEvent(full.google_event_id, {
            summary: `${svcName} — ${full.customer_name}`,
            startsAt: full.starts_at,
            endsAt: full.ends_at,
            attendeeEmail: full.customer_email,
            attendeeName: full.customer_name,
            status: "confirmed",
          });
          await supabaseAdmin.from("appointments").update({
            gcal_sync_status: "updated", gcal_sync_error: null, gcal_synced_at: new Date().toISOString(),
          } as never).eq("id", data.id);
        }
      }
    } catch (e) {
      console.error("[admin] gcal sync failed", e);
      await supabaseAdmin.from("appointments").update({
        gcal_sync_status: "failed",
        gcal_sync_error: e instanceof Error ? e.message : String(e),
      } as never).eq("id", data.id);
    }
    return { ok: true };
  });

export const adminCancelAppointment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: appt } = await supabaseAdmin
      .from("appointments").select("google_event_id").eq("id", data.id).maybeSingle();
    const { error } = await supabaseAdmin
      .from("appointments").update({ status: "cancelled" }).eq("id", data.id);
    if (error) throw new Error(error.message);
    if (appt?.google_event_id) {
      try {
        const { cancelCalendarEvent } = await import("@/lib/google-calendar.server");
        await cancelCalendarEvent(appt.google_event_id);
        await supabaseAdmin.from("appointments").update({
          gcal_sync_status: "cancelled", gcal_sync_error: null, gcal_synced_at: new Date().toISOString(),
        } as never).eq("id", data.id);
      } catch (e) {
        console.error("[admin] gcal cancel failed", e);
        await supabaseAdmin.from("appointments").update({
          gcal_sync_status: "failed",
          gcal_sync_error: e instanceof Error ? e.message : String(e),
        } as never).eq("id", data.id);
      }
    }
    return { ok: true };
  });


// ===== Clients =====
export const adminListClients = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: appts, error } = await supabaseAdmin
      .from("appointments")
      .select("customer_email, customer_name, customer_phone, starts_at, status, services(price_cents)")
      .order("starts_at", { ascending: false });
    if (error) throw new Error(error.message);
    const { data: notes } = await supabaseAdmin.from("client_notes").select("*");
    const noteMap = new Map((notes ?? []).map((n) => [n.customer_email.toLowerCase(), n]));
    const map = new Map<string, any>();
    for (const a of appts ?? []) {
      const key = (a.customer_email || "").toLowerCase();
      if (!key) continue;
      const existing = map.get(key);
      // @ts-ignore relation
      const cents = a.status !== "cancelled" ? (a.services?.price_cents ?? 0) : 0;
      if (!existing) {
        map.set(key, {
          email: a.customer_email,
          name: a.customer_name,
          phone: a.customer_phone,
          visits: 1,
          last_visit: a.starts_at,
          spend_cents: cents,
          note: noteMap.get(key) ?? null,
        });
      } else {
        existing.visits += 1;
        existing.spend_cents += cents;
        if (new Date(a.starts_at) > new Date(existing.last_visit)) {
          existing.last_visit = a.starts_at;
          existing.name = a.customer_name || existing.name;
          existing.phone = a.customer_phone || existing.phone;
        }
      }
    }
    return Array.from(map.values()).sort((a, b) =>
      new Date(b.last_visit).getTime() - new Date(a.last_visit).getTime());
  });

export const adminUpsertClientNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      customer_email: z.string().trim().email(),
      customer_name: z.string().trim().max(120).nullable().optional(),
      notes: z.string().trim().max(4000).nullable().optional(),
      allergies: z.string().trim().max(1000).nullable().optional(),
      hair_history: z.string().trim().max(4000).nullable().optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("client_notes")
      .upsert({
        customer_email: data.customer_email.toLowerCase(),
        customer_name: data.customer_name ?? null,
        notes: data.notes ?? null,
        allergies: data.allergies ?? null,
        hair_history: data.hair_history ?? null,
      }, { onConflict: "customer_email" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ===== Revenue =====
export const adminRevenueSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("appointments")
      .select("starts_at, status, services(price_cents, currency)")
      .neq("status", "cancelled")
      .order("starts_at", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []).map((a) => ({
      starts_at: a.starts_at,
      status: a.status,
      // @ts-ignore
      price_cents: a.services?.price_cents ?? 0,
      // @ts-ignore
      currency: a.services?.currency ?? "KES",
    }));
  });
