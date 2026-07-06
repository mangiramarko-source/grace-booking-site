import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  ArrowLeft, CalendarDays, ChevronLeft, ChevronRight, ClipboardList,
  Loader2, LogOut, MessageCircle, Plus, RefreshCw, Save, Scissors, Trash2, TrendingUp, Users, X,
} from "lucide-react";
import {
  adminAddBlocked, adminCancelAppointment, adminDeleteService, adminListAppointments,
  adminListBlocked, adminListClients, adminListHours, adminListServices, adminRemoveBlocked,
  adminRetryGcalSync, adminRevenueSummary, adminUpdateAppointment, adminUpdateHours,
  adminUpsertClientNote, adminUpsertService, claimAdminIfFirst,
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
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

const money = (cents: number, currency = "KES") =>
  new Intl.NumberFormat("en-KE", { style: "currency", currency, maximumFractionDigits: 0 }).format(cents / 100);

type Tab = "overview" | "clients" | "services" | "revenue" | "settings";

function GcalBadge({ status, title }: { status?: string | null; title?: string }) {
  const s = status ?? "pending";
  const cls = s === "created" || s === "updated"
    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
    : s === "cancelled"
    ? "bg-muted text-muted-foreground"
    : s === "failed"
    ? "bg-destructive/15 text-destructive"
    : "bg-amber-500/15 text-amber-700 dark:text-amber-400";
  return (
    <span title={title} className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${cls}`}>
      gcal: {s}
    </span>
  );
}

function AdminPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [tab, setTab] = useState<Tab>("overview");
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

  if (!ready) return <Shell><div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div></Shell>;
  if (!isAdmin) return <Shell><div className="text-muted-foreground">You are signed in but not an admin.</div></Shell>;

  return (
    <Shell rightSlot={
      <button onClick={signOut} className="inline-flex items-center gap-2 rounded-full border border-border/60 px-3 py-1.5 text-xs hover:bg-background">
        <LogOut className="h-3.5 w-3.5" /> Sign out
      </button>
    }>
      <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">Studio admin</h1>

      <nav className="mt-6 -mx-1 flex gap-1 overflow-x-auto pb-2">
        <TabButton active={tab === "overview"} onClick={() => setTab("overview")} icon={<CalendarDays className="h-4 w-4" />}>Overview</TabButton>
        <TabButton active={tab === "clients"} onClick={() => setTab("clients")} icon={<Users className="h-4 w-4" />}>Clients</TabButton>
        <TabButton active={tab === "services"} onClick={() => setTab("services")} icon={<Scissors className="h-4 w-4" />}>Services</TabButton>
        <TabButton active={tab === "revenue"} onClick={() => setTab("revenue")} icon={<TrendingUp className="h-4 w-4" />}>Revenue</TabButton>
        <TabButton active={tab === "settings"} onClick={() => setTab("settings")} icon={<ClipboardList className="h-4 w-4" />}>Settings</TabButton>
      </nav>

      <div className="mt-6">
        {tab === "overview" && <BookingOverview />}
        {tab === "clients" && <ClientsPanel />}
        {tab === "services" && <ServicesPanel />}
        {tab === "revenue" && <RevenuePanel />}
        {tab === "settings" && (
          <div className="space-y-10">
            <HoursPanel />
            <BlockedPanel />
          </div>
        )}
      </div>
    </Shell>
  );
}

function TabButton({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm transition-colors ${
        active ? "bg-cream text-primary-foreground" : "border border-border/60 text-muted-foreground hover:bg-background/60"
      }`}
    >
      {icon}{children}
    </button>
  );
}

/* =========================================================
   BOOKING OVERVIEW — Calendar with click-to-edit
   ========================================================= */
function BookingOverview() {
  const q = useQuery({ queryKey: ["admin", "appointments"], queryFn: () => adminListAppointments() });
  const [cursor, setCursor] = useState(() => {
    const d = new Date(); d.setDate(1); return d;
  });
  const [selected, setSelected] = useState<string | null>(null);
  const [editing, setEditing] = useState<any | null>(null);

  const apptsByDay = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const a of q.data ?? []) {
      const key = fmt(a.starts_at, { year: "numeric", month: "2-digit", day: "2-digit" }); // dd/mm/yyyy
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(a);
    }
    return map;
  }, [q.data]);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: Array<{ date: Date | null; key: string }> = [];
  for (let i = 0; i < firstDow; i++) cells.push({ date: null, key: `e${i}` });
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);
    cells.push({ date, key: date.toISOString() });
  }
  const todayKey = fmt(new Date().toISOString(), { year: "numeric", month: "2-digit", day: "2-digit" });

  const selectedDay = selected ? (apptsByDay.get(selected) ?? []) : [];

  return (
    <section>
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl">Booking overview</h2>
        <div className="flex items-center gap-1 rounded-full border border-border/60 bg-background/40 p-1">
          <button onClick={() => setCursor(new Date(year, month - 1, 1))} className="rounded-full p-1.5 hover:bg-background"><ChevronLeft className="h-4 w-4" /></button>
          <span className="px-3 text-sm font-medium">{MONTHS[month]} {year}</span>
          <button onClick={() => setCursor(new Date(year, month + 1, 1))} className="rounded-full p-1.5 hover:bg-background"><ChevronRight className="h-4 w-4" /></button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-7 gap-1 rounded-2xl border border-border/50 bg-background/30 p-2 md:p-3">
        {DAYS.map((d) => (
          <div key={d} className="px-1 py-2 text-center text-[10px] uppercase tracking-wider text-muted-foreground md:text-xs">{d}</div>
        ))}
        {cells.map((c) => {
          if (!c.date) return <div key={c.key} />;
          const dayKey = fmt(c.date.toISOString(), { year: "numeric", month: "2-digit", day: "2-digit" });
          const dayAppts = apptsByDay.get(dayKey) ?? [];
          const active = dayAppts.filter((a) => a.status !== "cancelled");
          const isToday = dayKey === todayKey;
          const isSelected = selected === dayKey;
          return (
            <button
              key={c.key}
              onClick={() => setSelected(dayKey)}
              className={`flex aspect-square flex-col items-stretch rounded-lg p-1.5 text-left transition-colors md:p-2 ${
                isSelected ? "bg-cream text-primary-foreground" :
                isToday ? "bg-accent/15 ring-1 ring-accent/40" :
                "hover:bg-background/60"
              }`}
            >
              <span className={`text-xs font-medium md:text-sm ${isSelected ? "" : "text-foreground"}`}>{c.date.getDate()}</span>
              {active.length > 0 && (
                <span className={`mt-auto inline-flex items-center gap-1 text-[10px] md:text-xs ${isSelected ? "text-primary-foreground/80" : "text-accent"}`}>
                  <span className="h-1.5 w-1.5 rounded-full bg-current" /> {active.length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {selected && (
        <div className="mt-5">
          <h3 className="text-sm font-medium text-muted-foreground">
            {fmt(new Date(selected.split("/").reverse().join("-")).toISOString(), { weekday: "long", day: "2-digit", month: "long" })}
            {" · "}{selectedDay.length} appointment{selectedDay.length === 1 ? "" : "s"}
          </h3>
          <div className="mt-3 grid gap-2">
            {selectedDay.length === 0 && <div className="rounded-xl border border-border/50 bg-background/30 p-4 text-sm text-muted-foreground">No appointments on this day.</div>}
            {selectedDay
              .sort((a: any, b: any) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())
              .map((a: any) => (
                <button key={a.id} onClick={() => setEditing(a)} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/50 bg-background/40 p-3 text-left transition-colors hover:bg-background/60">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-cream/30 px-3 py-2 text-sm font-medium tabular-nums">{fmt(a.starts_at, { hour: "2-digit", minute: "2-digit", hour12: false })}</div>
                    <div>
                      <div className="text-sm font-medium">{a.customer_name}</div>
                      <div className="text-xs text-muted-foreground">{a.service_name}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <GcalBadge status={a.gcal_sync_status} title={a.gcal_sync_error ?? undefined} />
                    <span className={`rounded-full px-2 py-0.5 text-xs ${a.status === "cancelled" ? "bg-destructive/15 text-destructive" : a.status === "completed" ? "bg-accent/15 text-accent" : "bg-cream/40 text-foreground"}`}>{a.status}</span>
                  </div>
                </button>
              ))}
          </div>
        </div>
      )}

      {editing && <AppointmentEditor appt={editing} onClose={() => setEditing(null)} />}
    </section>
  );
}

function AppointmentEditor({ appt, onClose }: { appt: any; onClose: () => void }) {
  const qc = useQueryClient();
  const update = useServerFn(adminUpdateAppointment);
  const cancel = useServerFn(adminCancelAppointment);
  const retrySync = useServerFn(adminRetryGcalSync);
  const [retrying, setRetrying] = useState(false);
  const startsLocal = useMemo(() => {
    const d = new Date(appt.starts_at);
    const pad = (n: number) => String(n).padStart(2, "0");
    // Convert to Nairobi local "YYYY-MM-DDTHH:MM"
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: NAIROBI_TZ, year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hour12: false,
    }).formatToParts(d);
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
    return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${pad(+get("minute"))}`;
  }, [appt.starts_at]);

  const [form, setForm] = useState({
    customer_name: appt.customer_name ?? "",
    customer_email: appt.customer_email ?? "",
    customer_phone: appt.customer_phone ?? "",
    notes: appt.notes ?? "",
    starts_at: startsLocal,
    status: appt.status as "confirmed" | "cancelled" | "completed",
  });
  const [saving, setSaving] = useState(false);

  const refetch = () => qc.invalidateQueries({ queryKey: ["admin", "appointments"] });

  const save = async () => {
    setSaving(true);
    try {
      // Convert Nairobi-local datetime back to ISO UTC (Africa/Nairobi is UTC+3, no DST)
      const [date, time] = form.starts_at.split("T");
      const [y, m, d] = date.split("-").map(Number);
      const [hh, mm] = time.split(":").map(Number);
      const iso = new Date(Date.UTC(y, m - 1, d, hh, mm) - 180 * 60 * 1000).toISOString();
      await update({ data: {
        id: appt.id,
        customer_name: form.customer_name,
        customer_email: form.customer_email,
        customer_phone: form.customer_phone || null,
        notes: form.notes || null,
        starts_at: iso,
        status: form.status,
      }});
      toast.success("Appointment updated");
      refetch();
      onClose();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setSaving(false); }
  };

  const doCancel = async () => {
    if (!confirm("Cancel this appointment?")) return;
    try { await cancel({ data: { id: appt.id } }); toast.success("Cancelled"); refetch(); onClose(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
  };

  const phoneDigits = (form.customer_phone || "").replace(/[^\d]/g, "");
  const waUrl = phoneDigits
    ? `https://wa.me/${phoneDigits}?text=${encodeURIComponent(`Hi ${form.customer_name}, regarding your appointment…`)}`
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 p-0 sm:items-center sm:p-6" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-lg overflow-hidden rounded-t-3xl bg-background shadow-2xl sm:rounded-3xl">
        <div className="flex items-center justify-between border-b border-border/40 px-5 py-4">
          <div>
            <div className="text-xs text-muted-foreground">{fmt(appt.starts_at, { weekday: "short", day: "2-digit", month: "short" })}</div>
            <div className="font-display text-lg">{appt.service_name}</div>
          </div>
          <button onClick={onClose} className="rounded-full p-1 hover:bg-background/60"><X className="h-5 w-5" /></button>
        </div>
        <div className="max-h-[70vh] space-y-3 overflow-y-auto px-5 py-4">
          <Field label="Customer">
            <input value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} className="input" />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Email">
              <input type="email" value={form.customer_email} onChange={(e) => setForm({ ...form, customer_email: e.target.value })} className="input" />
            </Field>
            <Field label="Phone">
              <input value={form.customer_phone} onChange={(e) => setForm({ ...form, customer_phone: e.target.value })} className="input" placeholder="+254…" />
            </Field>
          </div>
          <Field label="Date & time (Nairobi)">
            <input type="datetime-local" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} className="input" />
          </Field>
          <Field label="Status">
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as any })} className="input">
              <option value="confirmed">Confirmed</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </Field>
          <Field label="Notes">
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} className="input" />
          </Field>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/40 px-5 py-4">
          <div className="flex gap-2">
            {waUrl && (
              <a href={waUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full border border-border/60 px-3 py-1.5 text-xs hover:bg-background/60">
                <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
              </a>
            )}
            <button onClick={doCancel} className="inline-flex items-center gap-1.5 rounded-full border border-destructive/40 px-3 py-1.5 text-xs text-destructive hover:bg-destructive/10">
              <Trash2 className="h-3.5 w-3.5" /> Cancel
            </button>
          </div>
          <button disabled={saving} onClick={save} className="inline-flex items-center gap-1.5 rounded-full bg-cream px-4 py-2 text-sm text-primary-foreground disabled:opacity-60">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-xs text-muted-foreground">
      <div className="mb-1">{label}</div>
      {children}
    </label>
  );
}

/* =========================================================
   CLIENTS
   ========================================================= */
function ClientsPanel() {
  const q = useQuery({ queryKey: ["admin", "clients"], queryFn: () => adminListClients() });
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<any | null>(null);

  const filtered = (q.data ?? []).filter((c: any) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (c.name || "").toLowerCase().includes(s)
      || (c.email || "").toLowerCase().includes(s)
      || (c.phone || "").toLowerCase().includes(s);
  });

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-2xl">Client database</h2>
        <input
          value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, email, phone"
          className="w-full max-w-xs rounded-full border border-border/50 bg-background/40 px-4 py-2 text-sm sm:w-64"
        />
      </div>

      {/* Mobile cards */}
      <div className="mt-4 grid gap-2 md:hidden">
        {filtered.length === 0 && <div className="rounded-xl border border-border/50 p-4 text-sm text-muted-foreground">No clients yet.</div>}
        {filtered.map((c: any) => (
          <button key={c.email} onClick={() => setEditing(c)} className="rounded-xl border border-border/50 bg-background/40 p-3 text-left">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-sm font-medium">{c.name}</div>
                <div className="text-xs text-muted-foreground">{c.email}</div>
                {c.phone && <div className="text-xs text-muted-foreground">{c.phone}</div>}
              </div>
              <div className="text-right text-xs text-muted-foreground">
                <div>{c.visits} visit{c.visits === 1 ? "" : "s"}</div>
                <div>{money(c.spend_cents)}</div>
              </div>
            </div>
            {c.note?.notes && <div className="mt-2 line-clamp-2 text-xs text-muted-foreground">📝 {c.note.notes}</div>}
            {c.note?.allergies && <div className="mt-1 text-xs text-destructive">⚠ {c.note.allergies}</div>}
          </button>
        ))}
      </div>

      {/* Desktop table */}
      <div className="mt-4 hidden overflow-hidden rounded-2xl border border-border/50 md:block">
        <table className="w-full text-sm">
          <thead className="bg-background/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Client</th>
              <th className="px-4 py-3">Contact</th>
              <th className="px-4 py-3">Visits</th>
              <th className="px-4 py-3">Spend</th>
              <th className="px-4 py-3">Notes</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && <tr><td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">No clients yet.</td></tr>}
            {filtered.map((c: any) => (
              <tr key={c.email} className="border-t border-border/40 hover:bg-background/30">
                <td className="px-4 py-3 font-medium">{c.name}</td>
                <td className="px-4 py-3"><div>{c.email}</div>{c.phone && <div className="text-xs text-muted-foreground">{c.phone}</div>}</td>
                <td className="px-4 py-3 tabular-nums">{c.visits}</td>
                <td className="px-4 py-3 tabular-nums">{money(c.spend_cents)}</td>
                <td className="px-4 py-3 max-w-[280px]">
                  {c.note?.allergies && <div className="text-xs text-destructive">⚠ {c.note.allergies}</div>}
                  {c.note?.notes && <div className="truncate text-xs text-muted-foreground">{c.note.notes}</div>}
                  {!c.note?.notes && !c.note?.allergies && <span className="text-xs text-muted-foreground/70">—</span>}
                </td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => setEditing(c)} className="rounded-full border border-border/60 px-3 py-1 text-xs hover:bg-background/60">Edit</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && <ClientEditor client={editing} onClose={() => setEditing(null)} />}
    </section>
  );
}

function ClientEditor({ client, onClose }: { client: any; onClose: () => void }) {
  const qc = useQueryClient();
  const upsert = useServerFn(adminUpsertClientNote);
  const [form, setForm] = useState({
    notes: client.note?.notes ?? "",
    allergies: client.note?.allergies ?? "",
    hair_history: client.note?.hair_history ?? "",
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await upsert({ data: {
        customer_email: client.email,
        customer_name: client.name,
        notes: form.notes || null,
        allergies: form.allergies || null,
        hair_history: form.hair_history || null,
      }});
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: ["admin", "clients"] });
      onClose();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setSaving(false); }
  };

  const phoneDigits = (client.phone || "").replace(/[^\d]/g, "");
  const waUrl = phoneDigits ? `https://wa.me/${phoneDigits}` : null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 sm:items-center sm:p-6" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-lg overflow-hidden rounded-t-3xl bg-background shadow-2xl sm:rounded-3xl">
        <div className="flex items-center justify-between border-b border-border/40 px-5 py-4">
          <div>
            <div className="font-display text-lg">{client.name}</div>
            <div className="text-xs text-muted-foreground">{client.email}{client.phone ? ` · ${client.phone}` : ""}</div>
          </div>
          <button onClick={onClose} className="rounded-full p-1 hover:bg-background/60"><X className="h-5 w-5" /></button>
        </div>
        <div className="max-h-[70vh] space-y-3 overflow-y-auto px-5 py-4">
          <div className="grid grid-cols-2 gap-3 rounded-xl bg-background/40 p-3 text-center">
            <div><div className="text-xs text-muted-foreground">Visits</div><div className="font-display text-xl">{client.visits}</div></div>
            <div><div className="text-xs text-muted-foreground">Lifetime</div><div className="font-display text-xl">{money(client.spend_cents)}</div></div>
          </div>
          <Field label="Allergies / sensitivities">
            <textarea value={form.allergies} onChange={(e) => setForm({ ...form, allergies: e.target.value })} rows={2} className="input" placeholder="e.g. sensitive scalp, no PPD" />
          </Field>
          <Field label="Hair history">
            <textarea value={form.hair_history} onChange={(e) => setForm({ ...form, hair_history: e.target.value })} rows={3} className="input" placeholder="Previous colour, treatments, texture notes…" />
          </Field>
          <Field label="General notes">
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} className="input" placeholder="Preferences, conversation notes…" />
          </Field>
        </div>
        <div className="flex items-center justify-between gap-2 border-t border-border/40 px-5 py-4">
          {waUrl ? (
            <a href={waUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full border border-border/60 px-3 py-1.5 text-xs hover:bg-background/60">
              <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
            </a>
          ) : <span />}
          <button disabled={saving} onClick={save} className="inline-flex items-center gap-1.5 rounded-full bg-cream px-4 py-2 text-sm text-primary-foreground disabled:opacity-60">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save notes
          </button>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   REVENUE
   ========================================================= */
type Range = "day" | "week" | "month" | "year";
function RevenuePanel() {
  const q = useQuery({ queryKey: ["admin", "revenue"], queryFn: () => adminRevenueSummary() });
  const [range, setRange] = useState<Range>("month");

  const now = new Date();
  const rangeStart = (() => {
    const d = new Date(now);
    if (range === "day") d.setHours(0, 0, 0, 0);
    else if (range === "week") { d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - d.getDay()); }
    else if (range === "month") { d.setHours(0, 0, 0, 0); d.setDate(1); }
    else { d.setHours(0, 0, 0, 0); d.setMonth(0, 1); }
    return d;
  })();
  const rangeEnd = (() => {
    const d = new Date(rangeStart);
    if (range === "day") d.setDate(d.getDate() + 1);
    else if (range === "week") d.setDate(d.getDate() + 7);
    else if (range === "month") d.setMonth(d.getMonth() + 1);
    else d.setFullYear(d.getFullYear() + 1);
    return d;
  })();

  const rows = q.data ?? [];
  let past = 0, upcoming = 0, inRange = 0, count = 0;
  for (const r of rows) {
    const t = new Date(r.starts_at).getTime();
    if (t < now.getTime()) past += r.price_cents; else upcoming += r.price_cents;
    if (t >= rangeStart.getTime() && t < rangeEnd.getTime()) { inRange += r.price_cents; count += 1; }
  }
  const currency = rows[0]?.currency ?? "KES";

  // Trend bars (last 7/12 buckets)
  const buckets = useMemo(() => {
    const n = range === "day" ? 14 : range === "week" ? 8 : range === "month" ? 12 : 5;
    const out: { label: string; total: number }[] = [];
    for (let i = n - 1; i >= 0; i--) {
      const start = new Date(now);
      const end = new Date(now);
      if (range === "day") { start.setHours(0,0,0,0); start.setDate(start.getDate() - i); end.setTime(start.getTime()); end.setDate(end.getDate() + 1); }
      else if (range === "week") { start.setHours(0,0,0,0); start.setDate(start.getDate() - start.getDay() - i * 7); end.setTime(start.getTime()); end.setDate(end.getDate() + 7); }
      else if (range === "month") { start.setHours(0,0,0,0); start.setDate(1); start.setMonth(start.getMonth() - i); end.setTime(start.getTime()); end.setMonth(end.getMonth() + 1); }
      else { start.setHours(0,0,0,0); start.setMonth(0,1); start.setFullYear(start.getFullYear() - i); end.setTime(start.getTime()); end.setFullYear(end.getFullYear() + 1); }
      let total = 0;
      for (const r of rows) {
        const t = new Date(r.starts_at).getTime();
        if (t >= start.getTime() && t < end.getTime()) total += r.price_cents;
      }
      const label = range === "day" ? `${start.getDate()}/${start.getMonth()+1}`
        : range === "week" ? `${start.getDate()}/${start.getMonth()+1}`
        : range === "month" ? MONTHS[start.getMonth()].slice(0,3)
        : String(start.getFullYear());
      out.push({ label, total });
    }
    return out;
  }, [rows, range]);
  const maxBucket = Math.max(1, ...buckets.map((b) => b.total));

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-2xl">Revenue summary</h2>
        <div className="flex gap-1 rounded-full border border-border/60 bg-background/40 p-1 text-xs">
          {(["day","week","month","year"] as Range[]).map((r) => (
            <button key={r} onClick={() => setRange(r)} className={`rounded-full px-3 py-1 capitalize ${range === r ? "bg-cream text-primary-foreground" : "text-muted-foreground"}`}>{r}</button>
          ))}
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Stat label={`This ${range}`} value={money(inRange, currency)} sub={`${count} booking${count===1?"":"s"}`} highlight />
        <Stat label="Past revenue" value={money(past, currency)} sub="All confirmed past bookings" />
        <Stat label="Upcoming revenue" value={money(upcoming, currency)} sub="Booked & not cancelled" />
      </div>

      <div className="mt-6 rounded-2xl border border-border/50 bg-background/30 p-4">
        <div className="mb-3 text-xs uppercase tracking-wider text-muted-foreground">Trend ({range})</div>
        <div className="flex h-40 items-end gap-2">
          {buckets.map((b, i) => (
            <div key={i} className="flex flex-1 flex-col items-center gap-1">
              <div className="flex w-full flex-1 items-end">
                <div className="w-full rounded-t bg-cream/70" style={{ height: `${(b.total / maxBucket) * 100}%`, minHeight: b.total ? 4 : 0 }} />
              </div>
              <div className="text-[10px] text-muted-foreground">{b.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value, sub, highlight }: { label: string; value: string; sub?: string; highlight?: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 ${highlight ? "border-cream/60 bg-cream/10" : "border-border/50 bg-background/30"}`}>
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 font-display text-2xl tabular-nums">{value}</div>
      {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

/* =========================================================
   SERVICES, HOURS, BLOCKED  (largely as before, polished)
   ========================================================= */
function ServicesPanel() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin", "services-all"], queryFn: () => adminListServices() });
  const upsert = useServerFn(adminUpsertService);
  const del = useServerFn(adminDeleteService);
  return (
    <section>
      <h2 className="font-display text-2xl">Services</h2>
      <p className="mt-1 text-sm text-muted-foreground">Add, edit, or hide services. Price is stored in cents (e.g. 350000 = KES 3,500).</p>
      <div className="mt-4 grid gap-2">
        {q.data?.map((s: any) => (
          <ServiceRow key={s.id} s={s} onSave={async (data) => {
            try { await upsert({ data: { ...data, id: s.id } }); qc.invalidateQueries({ queryKey: ["admin", "services-all"] }); toast.success("Saved"); }
            catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
          }} onDelete={async () => {
            if (!confirm("Hide this service?")) return;
            try { await del({ data: { id: s.id } }); qc.invalidateQueries({ queryKey: ["admin", "services-all"] }); }
            catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
          }} />
        ))}
        <NewServiceRow onCreate={async (data) => {
          try { await upsert({ data }); qc.invalidateQueries({ queryKey: ["admin", "services-all"] }); toast.success("Service added"); }
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
      <input value={r.name} onChange={(e) => setR({ ...r, name: e.target.value })} className="input" />
      <input type="number" value={r.duration_minutes} onChange={(e) => setR({ ...r, duration_minutes: +e.target.value })} className="input" placeholder="min" />
      <input type="number" value={r.price_cents} onChange={(e) => setR({ ...r, price_cents: +e.target.value })} className="input" placeholder="price (cents)" />
      <input type="number" value={r.sort_order} onChange={(e) => setR({ ...r, sort_order: +e.target.value })} className="input" placeholder="sort" />
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
      <input value={r.name} onChange={(e) => setR({ ...r, name: e.target.value })} className="input" placeholder="New service name" />
      <input type="number" value={r.duration_minutes} onChange={(e) => setR({ ...r, duration_minutes: +e.target.value })} className="input" />
      <input type="number" value={r.price_cents} onChange={(e) => setR({ ...r, price_cents: +e.target.value })} className="input" />
      <input type="number" value={r.sort_order} onChange={(e) => setR({ ...r, sort_order: +e.target.value })} className="input" />
      <button onClick={() => r.name && onCreate(r)} className="inline-flex items-center gap-1 rounded-full bg-cream px-3 py-1 text-xs text-primary-foreground"><Plus className="h-3 w-3" /> Add</button>
    </div>
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
        {q.data?.map((row: any) => <HourRow key={row.day_of_week} row={row} onSave={save} />)}
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
      <input type="time" value={r.open_time} onChange={(e) => setR({ ...r, open_time: e.target.value })} className="input w-28" disabled={!r.is_open} />
      <span className="text-muted-foreground">–</span>
      <input type="time" value={r.close_time} onChange={(e) => setR({ ...r, close_time: e.target.value })} className="input w-28" disabled={!r.is_open} />
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
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input mt-1" />
        </label>
        <label className="flex-1 text-xs text-muted-foreground"><div>Reason (optional)</div>
          <input value={reason} onChange={(e) => setReason(e.target.value)} className="input mt-1 w-full" />
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

function Shell({ children, rightSlot }: { children: React.ReactNode; rightSlot?: React.ReactNode }) {
  return (
    <main className="min-h-screen px-4 py-6 md:px-8 md:py-12">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-center justify-between">
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Back home</Link>
          {rightSlot}
        </div>
        <div className="mt-6">{children}</div>
      </div>
      <style>{`.input{display:block;width:100%;border-radius:0.5rem;border:1px solid color-mix(in oklab,var(--border) 60%,transparent);background:color-mix(in oklab,var(--background) 60%,transparent);padding:0.4rem 0.65rem;font-size:0.875rem;line-height:1.25rem}.input:focus{outline:none;box-shadow:0 0 0 1px var(--ring)}`}</style>
    </main>
  );
}
