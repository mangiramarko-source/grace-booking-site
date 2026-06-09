import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Loader2, LogOut, Plus, Trash2 } from "lucide-react";
import {
  adminAddBlocked, adminDeleteService, adminListAppointments,
  adminListBlocked, adminListHours, adminListServices, adminRemoveBlocked,
  adminUpdateHours, adminUpsertService, claimAdminIfFirst,
} from "@/lib/admin.functions";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin — Hair by Makanye" }, { name: "robots", content: "noindex" }] }),
  ssr: false,
  component: AdminPage,
});

const NAIROBI_TZ = "Africa/Nairobi";
const fmt = (iso: string, opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: NAIROBI_TZ, ...opts }).format(new Date(iso));

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function AdminPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const claim = useServerFn(claimAdminIfFirst);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) { navigate({ to: "/auth" }); return; }
      try {
        const res = await claim();
        if (!cancelled) { setIsAdmin(res.isAdmin); setReady(true); }
      } catch { if (!cancelled) { setReady(true); } }
    })();
    return () => { cancelled = true; };
  }, [claim, navigate]);

  const signOut = async () => { await supabase.auth.signOut(); navigate({ to: "/auth" }); };

  if (!ready) return <Shell><div className="text-muted-foreground">Loading…</div></Shell>;
  if (!isAdmin) return <Shell><div className="text-muted-foreground">You are signed in but not an admin.</div></Shell>;

  return (
    <Shell rightSlot={
      <button onClick={signOut} className="inline-flex items-center gap-2 rounded-full border border-border/60 px-3 py-1.5 text-xs hover:bg-background">
        <LogOut className="h-3.5 w-3.5" /> Sign out
      </button>
    }>
      <h1 className="font-display text-4xl font-semibold tracking-tight">Studio admin</h1>
      <div className="mt-8 space-y-12">
        <AppointmentsPanel />
        <HoursPanel />
        <BlockedPanel />
        <ServicesPanel />
      </div>
    </Shell>
  );
}

function AppointmentsPanel() {
  const q = useQuery({ queryKey: ["admin", "appointments"], queryFn: () => adminListAppointments() });
  return (
    <section>
      <h2 className="font-display text-2xl">Upcoming appointments</h2>
      <div className="mt-4 overflow-hidden rounded-2xl border border-border/50">
        <table className="w-full text-sm">
          <thead className="bg-background/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr><th className="px-4 py-3">When</th><th className="px-4 py-3">Service</th><th className="px-4 py-3">Customer</th><th className="px-4 py-3">Status</th></tr>
          </thead>
          <tbody>
            {q.data?.length === 0 && <tr><td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">No appointments yet.</td></tr>}
            {q.data?.map((a: any) => (
              <tr key={a.id} className="border-t border-border/40">
                <td className="px-4 py-3">{fmt(a.starts_at, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false })}</td>
                <td className="px-4 py-3">{a.service_name}</td>
                <td className="px-4 py-3"><div>{a.customer_name}</div><div className="text-xs text-muted-foreground">{a.customer_email}{a.customer_phone ? ` · ${a.customer_phone}` : ""}</div></td>
                <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-xs ${a.status === "cancelled" ? "bg-destructive/15 text-destructive" : "bg-accent/15 text-accent"}`}>{a.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function HoursPanel() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin", "hours"], queryFn: () => adminListHours() });
  const update = useServerFn(adminUpdateHours);
  const save = async (row: any) => {
    try { await update({ data: { day_of_week: row.day_of_week, is_open: row.is_open, open_time: row.open_time, close_time: row.close_time } });
      toast.success("Saved"); qc.invalidateQueries({ queryKey: ["admin", "hours"] }); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
  };
  return (
    <section>
      <h2 className="font-display text-2xl">Weekly hours</h2>
      <div className="mt-4 grid gap-2">
        {q.data?.map((row: any) => (
          <HourRow key={row.day_of_week} row={row} onSave={save} />
        ))}
      </div>
    </section>
  );
}
function HourRow({ row, onSave }: { row: any; onSave: (r: any) => void }) {
  const [r, setR] = useState({ ...row, open_time: (row.open_time as string).slice(0, 5), close_time: (row.close_time as string).slice(0, 5) });
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border/50 bg-background/40 px-4 py-3">
      <span className="w-12 font-medium">{DAYS[r.day_of_week]}</span>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={r.is_open} onChange={(e) => setR({ ...r, is_open: e.target.checked })} /> Open
      </label>
      <input type="time" value={r.open_time} onChange={(e) => setR({ ...r, open_time: e.target.value })} className="rounded-md border border-border/50 bg-background/60 px-2 py-1 text-sm" disabled={!r.is_open} />
      <span className="text-muted-foreground">–</span>
      <input type="time" value={r.close_time} onChange={(e) => setR({ ...r, close_time: e.target.value })} className="rounded-md border border-border/50 bg-background/60 px-2 py-1 text-sm" disabled={!r.is_open} />
      <button onClick={() => onSave(r)} className="ml-auto rounded-full bg-cream px-3 py-1 text-xs text-primary-foreground">Save</button>
    </div>
  );
}

function BlockedPanel() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin", "blocked"], queryFn: () => adminListBlocked() });
  const add = useServerFn(adminAddBlocked);
  const remove = useServerFn(adminRemoveBlocked);
  const [date, setDate] = useState(""); const [reason, setReason] = useState("");

  const doAdd = async () => {
    if (!date) return;
    try { await add({ data: { blocked_date: date, reason: reason || null } }); setDate(""); setReason("");
      qc.invalidateQueries({ queryKey: ["admin", "blocked"] }); toast.success("Date blocked"); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
  };
  const doRemove = async (id: string) => {
    try { await remove({ data: { id } }); qc.invalidateQueries({ queryKey: ["admin", "blocked"] }); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
  };

  return (
    <section>
      <h2 className="font-display text-2xl">Blocked dates</h2>
      <div className="mt-4 flex flex-wrap items-end gap-2 rounded-xl border border-border/50 bg-background/40 p-3">
        <label className="text-xs text-muted-foreground"><div>Date</div>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1 rounded-md border border-border/50 bg-background/60 px-2 py-1 text-sm" />
        </label>
        <label className="flex-1 text-xs text-muted-foreground"><div>Reason (optional)</div>
          <input value={reason} onChange={(e) => setReason(e.target.value)} className="mt-1 w-full rounded-md border border-border/50 bg-background/60 px-2 py-1 text-sm" />
        </label>
        <button onClick={doAdd} className="inline-flex items-center gap-1 rounded-full bg-cream px-3 py-1.5 text-xs text-primary-foreground"><Plus className="h-3 w-3" /> Block</button>
      </div>
      <div className="mt-3 grid gap-2">
        {q.data?.length === 0 && <div className="text-sm text-muted-foreground">No blocked dates.</div>}
        {q.data?.map((b: any) => (
          <div key={b.id} className="flex items-center justify-between rounded-lg border border-border/50 bg-background/40 px-3 py-2 text-sm">
            <div><span className="font-medium">{b.blocked_date}</span> {b.reason && <span className="ml-2 text-muted-foreground">— {b.reason}</span>}</div>
            <button onClick={() => doRemove(b.id)} className="text-destructive hover:opacity-80"><Trash2 className="h-4 w-4" /></button>
          </div>
        ))}
      </div>
    </section>
  );
}

function ServicesPanel() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin", "services"], queryFn: () => adminListServices() });
  const upsert = useServerFn(adminUpsertService);
  const del = useServerFn(adminDeleteService);
  return (
    <section>
      <h2 className="font-display text-2xl">Services</h2>
      <div className="mt-4 grid gap-2">
        {q.data?.map((s: any) => (
          <ServiceRow key={s.id} s={s} onSave={async (data) => {
            try { await upsert({ data: { ...data, id: s.id } }); qc.invalidateQueries({ queryKey: ["admin", "services"] }); toast.success("Saved"); }
            catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
          }} onDelete={async () => {
            if (!confirm("Hide this service?")) return;
            try { await del({ data: { id: s.id } }); qc.invalidateQueries({ queryKey: ["admin", "services"] }); }
            catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
          }} />
        ))}
        <NewServiceRow onCreate={async (data) => {
          try { await upsert({ data }); qc.invalidateQueries({ queryKey: ["admin", "services"] }); toast.success("Service added"); }
          catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
        }} />
      </div>
    </section>
  );
}

function ServiceRow({ s, onSave, onDelete }: { s: any; onSave: (d: any) => void; onDelete: () => void }) {
  const [r, setR] = useState({ name: s.name, description: s.description ?? "", duration_minutes: s.duration_minutes, price_cents: s.price_cents, currency: s.currency, sort_order: s.sort_order, is_active: s.is_active });
  return (
    <div className="grid gap-2 rounded-xl border border-border/50 bg-background/40 p-3 sm:grid-cols-[1fr_90px_120px_90px_auto]">
      <input value={r.name} onChange={(e) => setR({ ...r, name: e.target.value })} className="rounded-md border border-border/50 bg-background/60 px-2 py-1 text-sm" />
      <input type="number" value={r.duration_minutes} onChange={(e) => setR({ ...r, duration_minutes: +e.target.value })} className="rounded-md border border-border/50 bg-background/60 px-2 py-1 text-sm" placeholder="min" />
      <input type="number" value={r.price_cents} onChange={(e) => setR({ ...r, price_cents: +e.target.value })} className="rounded-md border border-border/50 bg-background/60 px-2 py-1 text-sm" placeholder="price (cents)" />
      <input type="number" value={r.sort_order} onChange={(e) => setR({ ...r, sort_order: +e.target.value })} className="rounded-md border border-border/50 bg-background/60 px-2 py-1 text-sm" placeholder="sort" />
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={r.is_active} onChange={(e) => setR({ ...r, is_active: e.target.checked })} /> Active</label>
        <button onClick={() => onSave(r)} className="rounded-full bg-cream px-3 py-1 text-xs text-primary-foreground">Save</button>
        <button onClick={onDelete} className="text-destructive"><Trash2 className="h-4 w-4" /></button>
      </div>
    </div>
  );
}
function NewServiceRow({ onCreate }: { onCreate: (d: any) => void }) {
  const [r, setR] = useState({ name: "", description: "", duration_minutes: 60, price_cents: 0, currency: "KES", sort_order: 99, is_active: true });
  return (
    <div className="grid gap-2 rounded-xl border border-dashed border-border/60 bg-background/20 p-3 sm:grid-cols-[1fr_90px_120px_90px_auto]">
      <input value={r.name} onChange={(e) => setR({ ...r, name: e.target.value })} className="rounded-md border border-border/50 bg-background/60 px-2 py-1 text-sm" placeholder="New service name" />
      <input type="number" value={r.duration_minutes} onChange={(e) => setR({ ...r, duration_minutes: +e.target.value })} className="rounded-md border border-border/50 bg-background/60 px-2 py-1 text-sm" />
      <input type="number" value={r.price_cents} onChange={(e) => setR({ ...r, price_cents: +e.target.value })} className="rounded-md border border-border/50 bg-background/60 px-2 py-1 text-sm" />
      <input type="number" value={r.sort_order} onChange={(e) => setR({ ...r, sort_order: +e.target.value })} className="rounded-md border border-border/50 bg-background/60 px-2 py-1 text-sm" />
      <button onClick={() => r.name && onCreate(r)} className="inline-flex items-center gap-1 rounded-full bg-cream px-3 py-1 text-xs text-primary-foreground"><Plus className="h-3 w-3" /> Add</button>
    </div>
  );
}

function Shell({ children, rightSlot }: { children: React.ReactNode; rightSlot?: React.ReactNode }) {
  return (
    <main className="min-h-screen px-5 py-8 md:px-8 md:py-12">
      <div className="mx-auto max-w-5xl">
        <div className="flex items-center justify-between">
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Back home</Link>
          {rightSlot}
        </div>
        <div className="mt-6">{children}</div>
      </div>
    </main>
  );
}
