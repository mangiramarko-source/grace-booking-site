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
      .select("id, customer_name, customer_email, customer_phone, notes, starts_at, ends_at, status, services(name)")
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
