import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Calendar as CalendarIcon, Check, Clock, Copy, Loader2 } from "lucide-react";
import {
  createBooking,
  getAvailability,
  getServices,
} from "@/lib/booking.functions";

export const Route = createFileRoute("/book")({
  head: () => ({
    meta: [
      { title: "Book an Appointment — Hair by Makanye" },
      { name: "description", content: "Choose a service, pick a date and time, and confirm your appointment with Hair by Makanye in Nairobi." },
      { property: "og:title", content: "Book an Appointment — Hair by Makanye" },
      { property: "og:description", content: "Real-time availability for braids, locs, twists and natural hair styling." },
    ],
  }),
  component: BookPage,
});

const NAIROBI_TZ = "Africa/Nairobi";

function formatNairobi(iso: string, opts: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: NAIROBI_TZ, ...opts }).format(new Date(iso));
}

function todayInNairobi(): string {
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: NAIROBI_TZ, year: "numeric", month: "2-digit", day: "2-digit" });
  return fmt.format(new Date());
}

function addDaysISO(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const t = Date.UTC(y, m - 1, d) + days * 86400000;
  const dt = new Date(t);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function BookPage() {
  const services = useQuery({ queryKey: ["services"], queryFn: () => getServices() });

  const [serviceId, setServiceId] = useState<string | null>(null);
  const [date, setDate] = useState<string>(todayInNairobi());
  const [slot, setSlot] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<null | {
    cancelToken: string;
    serviceName: string;
    startsAt: string;
    endsAt: string;
  }>(null);

  const selectedService = useMemo(
    () => services.data?.find((s) => s.id === serviceId) ?? null,
    [services.data, serviceId],
  );

  const availability = useQuery({
    queryKey: ["availability", serviceId, date],
    queryFn: () => getAvailability({ data: { serviceId: serviceId!, date } }),
    enabled: !!serviceId && !!date,
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
  });

  if (confirmation) {
    return <Confirmation conf={confirmation} />;
  }

  const dates = Array.from({ length: 14 }, (_, i) => addDaysISO(todayInNairobi(), i));

  return (
    <main className="relative min-h-screen px-5 py-10 md:px-8 md:py-16">
      <div className="mx-auto max-w-3xl">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <h1 className="mt-6 font-display text-4xl font-semibold tracking-tight md:text-5xl">
          Book your <span className="text-gradient-gold italic">chair</span>
        </h1>
        <p className="mt-2 text-muted-foreground">Choose a service, pick a date and time, and confirm.</p>

        {/* Step 1: Service */}
        <section className="mt-10">
          <SectionHeader step={1} title="Choose a service" />
          {services.isLoading ? (
            <SkeletonBlock />
          ) : (
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {services.data?.map((s) => {
                const active = s.id === serviceId;
                return (
                  <button
                    key={s.id}
                    onClick={() => { setServiceId(s.id); setSlot(null); }}
                    className={`text-left rounded-2xl border p-4 transition ${active ? "border-accent bg-accent/5" : "border-border/50 bg-background/40 hover:border-border"}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-display text-lg">{s.name}</div>
                        <div className="mt-1 text-xs text-muted-foreground flex items-center gap-2">
                          <Clock className="h-3.5 w-3.5" /> {s.duration_minutes} min
                        </div>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {s.price_cents > 0 ? `${s.currency} ${(s.price_cents / 100).toLocaleString()}` : "On request"}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* Step 2: Date */}
        {serviceId && (
          <section className="mt-10">
            <SectionHeader step={2} title="Pick a date" />
            <div className="mt-4 -mx-1 flex gap-2 overflow-x-auto pb-2 px-1">
              {dates.map((d) => {
                const dt = new Date(d + "T12:00:00Z");
                const day = new Intl.DateTimeFormat("en", { weekday: "short", timeZone: "UTC" }).format(dt);
                const num = dt.getUTCDate();
                const active = d === date;
                return (
                  <button
                    key={d}
                    onClick={() => { setDate(d); setSlot(null); }}
                    className={`min-w-[64px] rounded-xl border px-3 py-2 text-center transition ${active ? "border-cream bg-cream text-primary-foreground" : "border-border/50 bg-background/40 hover:border-border"}`}
                  >
                    <div className="text-[10px] uppercase tracking-wider opacity-80">{day}</div>
                    <div className="text-lg font-semibold">{num}</div>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* Step 3: Slot */}
        {serviceId && (
          <section className="mt-10">
            <SectionHeader step={3} title="Pick a time" hint="Live availability" />
            {availability.isLoading ? (
              <SkeletonBlock />
            ) : availability.data?.reason === "closed" ? (
              <EmptyState text="Closed this day." />
            ) : availability.data?.reason === "blocked" ? (
              <EmptyState text="The studio is unavailable this date." />
            ) : availability.data && availability.data.slots.length === 0 ? (
              <EmptyState text="Fully booked. Try another date." />
            ) : (
              <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
                {availability.data?.slots.map((iso) => {
                  const label = formatNairobi(iso, { hour: "2-digit", minute: "2-digit", hour12: false });
                  const active = iso === slot;
                  return (
                    <button
                      key={iso}
                      onClick={() => setSlot(iso)}
                      className={`rounded-lg border px-3 py-2 text-sm transition ${active ? "border-accent bg-accent/10 text-foreground" : "border-border/50 bg-background/40 hover:border-border"}`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* Step 4: Details */}
        {serviceId && slot && selectedService && (
          <BookingForm
            serviceId={serviceId}
            slotIso={slot}
            serviceName={selectedService.name}
            onSuccess={(c) => setConfirmation(c)}
          />
        )}
      </div>
    </main>
  );
}

function SectionHeader({ step, title, hint }: { step: number; title: string; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <div className="flex items-center gap-3">
        <span className="grid h-6 w-6 place-items-center rounded-full bg-cream text-xs font-semibold text-primary-foreground">{step}</span>
        <h2 className="font-display text-xl">{title}</h2>
      </div>
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </div>
  );
}

function SkeletonBlock() { return <div className="mt-4 h-24 animate-pulse rounded-xl bg-muted/30" />; }
function EmptyState({ text }: { text: string }) {
  return <div className="mt-4 rounded-xl border border-border/50 bg-background/40 p-6 text-center text-sm text-muted-foreground">{text}</div>;
}

function BookingForm({ serviceId, slotIso, serviceName, onSuccess }: {
  serviceId: string;
  slotIso: string;
  serviceName: string;
  onSuccess: (c: { cancelToken: string; serviceName: string; startsAt: string; endsAt: string }) => void;
}) {
  const create = useServerFn(createBooking);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", notes: "" });

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim()) {
      toast.error("Name and email are required");
      return;
    }
    setSubmitting(true);
    try {
      const res = await create({ data: {
        serviceId, startsAt: slotIso,
        customerName: form.name.trim(),
        customerEmail: form.email.trim(),
        customerPhone: form.phone.trim() || null,
        notes: form.notes.trim() || null,
      }});
      toast.success("Appointment confirmed");
      onSuccess({ cancelToken: res.cancelToken, serviceName: res.serviceName, startsAt: res.startsAt, endsAt: res.endsAt });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not book");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="mt-10">
      <SectionHeader step={4} title="Your details" />
      <form onSubmit={onSubmit} className="mt-4 grid gap-3 rounded-2xl border border-border/50 bg-background/40 p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Full name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required />
          <Field label="Email" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} required />
        </div>
        <Field label="Phone (optional)" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
        <Field label="Notes (optional)" textarea value={form.notes} onChange={(v) => setForm({ ...form, notes: v })} />

        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-muted-foreground flex items-center gap-2">
            <CalendarIcon className="h-4 w-4 text-accent" />
            {serviceName} · {formatNairobi(slotIso, { weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false })}
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-cream px-5 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Confirm booking
          </button>
        </div>
      </form>
    </section>
  );
}

function Field({ label, value, onChange, type = "text", required, textarea }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean; textarea?: boolean;
}) {
  const base = "w-full rounded-lg border border-border/50 bg-background/60 px-3 py-2 text-sm outline-none focus:border-accent";
  return (
    <label className="block">
      <span className="text-xs text-muted-foreground">{label}{required && " *"}</span>
      {textarea ? (
        <textarea rows={3} className={`${base} mt-1`} value={value} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input type={type} required={required} className={`${base} mt-1`} value={value} onChange={(e) => onChange(e.target.value)} />
      )}
    </label>
  );
}

function Confirmation({ conf }: { conf: { cancelToken: string; serviceName: string; startsAt: string; endsAt: string } }) {
  const url = typeof window !== "undefined" ? `${window.location.origin}/booking/${conf.cancelToken}` : `/booking/${conf.cancelToken}`;
  return (
    <main className="min-h-screen px-5 py-16 md:px-8">
      <div className="mx-auto max-w-xl text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-accent/15 text-accent">
          <Check className="h-7 w-7" />
        </div>
        <h1 className="mt-6 font-display text-4xl font-semibold">You're booked</h1>
        <p className="mt-2 text-muted-foreground">We can't wait to see you.</p>

        <div className="mt-8 rounded-2xl border border-border/50 bg-background/40 p-6 text-left">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Service</div>
          <div className="font-display text-xl">{conf.serviceName}</div>
          <div className="mt-4 text-xs uppercase tracking-wider text-muted-foreground">When</div>
          <div className="font-medium">
            {formatNairobi(conf.startsAt, { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}
          </div>
          <div className="text-sm text-muted-foreground">
            {formatNairobi(conf.startsAt, { hour: "2-digit", minute: "2-digit", hour12: false })} – {formatNairobi(conf.endsAt, { hour: "2-digit", minute: "2-digit", hour12: false })} (Nairobi)
          </div>

          <div className="mt-6 rounded-xl border border-border/50 bg-background/60 p-3">
            <div className="text-xs text-muted-foreground">Cancel or reschedule link</div>
            <div className="mt-1 flex items-center gap-2">
              <code className="flex-1 truncate text-xs">{url}</code>
              <button
                onClick={() => { navigator.clipboard.writeText(url); toast.success("Link copied"); }}
                className="inline-flex items-center gap-1 rounded-md border border-border/60 px-2 py-1 text-xs hover:bg-background"
              >
                <Copy className="h-3 w-3" /> Copy
              </button>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">Save this link — anyone with it can manage this booking.</p>
          </div>
        </div>

        <div className="mt-6 flex justify-center gap-3">
          <Link to="/booking/$token" params={{ token: conf.cancelToken }} className="rounded-full border border-border/60 px-4 py-2 text-sm hover:bg-background">Manage booking</Link>
          <Link to="/" className="rounded-full bg-cream px-4 py-2 text-sm text-primary-foreground">Home</Link>
        </div>
      </div>
    </main>
  );
}
