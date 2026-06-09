import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Calendar as CalendarIcon, Loader2, X } from "lucide-react";
import {
  cancelBooking,
  getAvailability,
  getBookingByToken,
  rescheduleBooking,
} from "@/lib/booking.functions";

export const Route = createFileRoute("/booking/$token")({
  head: () => ({
    meta: [
      { title: "Manage your booking — Hair by Makanye" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ManageBooking,
});

const NAIROBI_TZ = "Africa/Nairobi";
const fmt = (iso: string, opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: NAIROBI_TZ, ...opts }).format(new Date(iso));

function todayInNairobi(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: NAIROBI_TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}
function addDaysISO(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d) + days * 86400000);
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}

function ManageBooking() {
  const { token } = Route.useParams();
  const router = useRouter();
  const booking = useQuery({
    queryKey: ["booking", token],
    queryFn: () => getBookingByToken({ data: { token } }),
  });
  const doCancel = useServerFn(cancelBooking);
  const doReschedule = useServerFn(rescheduleBooking);

  const [rescheduling, setRescheduling] = useState(false);
  const [date, setDate] = useState<string>(todayInNairobi());
  const [slot, setSlot] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const serviceId = booking.data?.serviceId ?? null;
  const availability = useQuery({
    queryKey: ["availability", serviceId, date],
    queryFn: () => getAvailability({ data: { serviceId: serviceId!, date } }),
    enabled: !!serviceId && rescheduling,
    refetchInterval: 15_000,
  });

  const dates = useMemo(() => Array.from({ length: 14 }, (_, i) => addDaysISO(todayInNairobi(), i)), []);

  if (booking.isLoading) return <Shell><div className="text-muted-foreground">Loading…</div></Shell>;
  if (!booking.data) return <Shell><div className="text-muted-foreground">Booking not found.</div></Shell>;

  const b = booking.data;
  const cancelled = b.status === "cancelled";

  const onCancel = async () => {
    if (!confirm("Cancel this appointment?")) return;
    setBusy(true);
    try { await doCancel({ data: { token } }); toast.success("Appointment cancelled"); router.invalidate(); booking.refetch(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); } finally { setBusy(false); }
  };
  const onReschedule = async () => {
    if (!slot) return;
    setBusy(true);
    try {
      await doReschedule({ data: { token, startsAt: slot } });
      toast.success("Rescheduled");
      setRescheduling(false); setSlot(null);
      booking.refetch();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); } finally { setBusy(false); }
  };

  return (
    <Shell>
      <h1 className="font-display text-4xl font-semibold tracking-tight">Your booking</h1>

      <div className="mt-6 rounded-2xl border border-border/50 bg-background/40 p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Service</div>
            <div className="font-display text-xl">{b.serviceName}</div>
            <div className="mt-3 text-xs uppercase tracking-wider text-muted-foreground">When</div>
            <div className="font-medium">{fmt(b.startsAt, { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}</div>
            <div className="text-sm text-muted-foreground">
              {fmt(b.startsAt, { hour: "2-digit", minute: "2-digit", hour12: false })} – {fmt(b.endsAt, { hour: "2-digit", minute: "2-digit", hour12: false })} (Nairobi)
            </div>
            <div className="mt-3 text-xs uppercase tracking-wider text-muted-foreground">Booked under</div>
            <div className="text-sm">{b.customerName} · {b.customerEmail}</div>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs ${cancelled ? "bg-destructive/15 text-destructive" : "bg-accent/15 text-accent"}`}>
            {cancelled ? "Cancelled" : "Confirmed"}
          </span>
        </div>

        {!cancelled && (
          <div className="mt-6 flex flex-wrap gap-2">
            <button
              onClick={() => setRescheduling((v) => !v)}
              className="inline-flex items-center gap-2 rounded-full border border-border/60 px-4 py-2 text-sm hover:bg-background"
            >
              <CalendarIcon className="h-4 w-4" /> {rescheduling ? "Cancel reschedule" : "Reschedule"}
            </button>
            <button
              onClick={onCancel}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-full border border-destructive/40 px-4 py-2 text-sm text-destructive hover:bg-destructive/10 disabled:opacity-60"
            >
              <X className="h-4 w-4" /> Cancel appointment
            </button>
          </div>
        )}
      </div>

      {!cancelled && rescheduling && (
        <section className="mt-8 rounded-2xl border border-border/50 bg-background/40 p-5">
          <h2 className="font-display text-xl">Pick a new time</h2>

          <div className="mt-4 -mx-1 flex gap-2 overflow-x-auto px-1 pb-2">
            {dates.map((d) => {
              const dt = new Date(d + "T12:00:00Z");
              const day = new Intl.DateTimeFormat("en", { weekday: "short", timeZone: "UTC" }).format(dt);
              const active = d === date;
              return (
                <button key={d} onClick={() => { setDate(d); setSlot(null); }}
                  className={`min-w-[64px] rounded-xl border px-3 py-2 text-center ${active ? "border-cream bg-cream text-primary-foreground" : "border-border/50 hover:border-border"}`}>
                  <div className="text-[10px] uppercase tracking-wider opacity-80">{day}</div>
                  <div className="text-lg font-semibold">{dt.getUTCDate()}</div>
                </button>
              );
            })}
          </div>

          {availability.isLoading ? (
            <div className="mt-4 h-20 animate-pulse rounded-xl bg-muted/30" />
          ) : availability.data?.reason ? (
            <div className="mt-4 text-sm text-muted-foreground">{availability.data.reason === "closed" ? "Closed this day." : "Unavailable."}</div>
          ) : availability.data?.slots.length === 0 ? (
            <div className="mt-4 text-sm text-muted-foreground">Fully booked. Try another date.</div>
          ) : (
            <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
              {availability.data?.slots.map((iso) => {
                const active = iso === slot;
                return (
                  <button key={iso} onClick={() => setSlot(iso)}
                    className={`rounded-lg border px-3 py-2 text-sm ${active ? "border-accent bg-accent/10" : "border-border/50 hover:border-border"}`}>
                    {fmt(iso, { hour: "2-digit", minute: "2-digit", hour12: false })}
                  </button>
                );
              })}
            </div>
          )}

          <div className="mt-5 flex justify-end">
            <button
              onClick={onReschedule}
              disabled={!slot || busy}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-cream px-5 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              Confirm new time
            </button>
          </div>
        </section>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen px-5 py-10 md:px-8 md:py-16">
      <div className="mx-auto max-w-2xl">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back home
        </Link>
        <div className="mt-6">{children}</div>
      </div>
    </main>
  );
}
