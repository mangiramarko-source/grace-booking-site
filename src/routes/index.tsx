import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { ArrowRight, Instagram, MapPin, Mail, Phone, Sparkles, Check } from "lucide-react";
import heroBg from "@/assets/african-woman.png.asset.json";
import { toast } from "sonner";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Hair by Makanye — Bespoke African Hair Artistry, Nairobi" },
      { name: "description", content: "Braiding, locs, twists and natural hair styling, crafted in Nairobi. Book your chair with Makanye." },
    ],
  }),
  component: Index,
});

const services = [
  { name: "Knotless Braids", desc: "Lightweight, scalp-friendly braids in any length or part.", tags: ["Protective", "Long-wear", "Custom parts"], from: "KSh 6,500" },
  { name: "Boho & Goddess", desc: "Soft curly ends woven through braids and twists.", tags: ["Boho", "Curls", "Editorial"], from: "KSh 8,500" },
  { name: "Locs & Sisterlocks", desc: "Starter locs, retwists and styling for established journeys.", tags: ["Starter", "Retwist", "Styling"], from: "KSh 4,000" },
  { name: "Twists & Cornrows", desc: "Senegalese, Marley, Passion twists and feed-in cornrows.", tags: ["Twists", "Cornrows", "Feed-in"], from: "KSh 5,000" },
  { name: "Natural Hair Care", desc: "Wash, deep condition, treatments and silk press.", tags: ["Wash", "Treatment", "Silk press"], from: "KSh 3,500" },
  { name: "Bridal & Editorial", desc: "Statement crowns for weddings, shoots and red carpets.", tags: ["Bridal", "Editorial", "On-location"], from: "On request" },
];

const principles = [
  { title: "Crown-led", body: "Every chair starts with your hair story — health, texture and life come first." },
  { title: "Built to last", body: "Tension-aware techniques and clean parting that wear beautifully for weeks." },
  { title: "Artistry in practice", body: "Considered colour, shape and finish — informed by editorial and culture." },
];

function Index() {
  return (
    <div className="relative min-h-screen text-foreground">
      <BackgroundLayer />
      <div className="relative z-10">
        <Nav />
        <Hero />
        <Marquee />
        <About />
        <Services />
        <Why />
        <Booking />
        <Contact />
        <Footer />
      </div>
    </div>
  );
}

function BackgroundLayer() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 glow-bg" />
  );
}

function Nav() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 80);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  const links = [
    { href: "#about", label: "About" },
    { href: "#services", label: "Services" },
    { href: "#why", label: "Why Us" },
    { href: "#contact", label: "Contact" },
  ];
  return (
    <header
      className={`fixed left-0 right-0 z-40 px-4 transition-all duration-500 ease-out ${
        scrolled
          ? "top-3 md:top-5 opacity-100 translate-y-0 pointer-events-auto"
          : "top-0 -translate-y-4 opacity-0 pointer-events-none"
      }`}
    >
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 rounded-full border border-border/50 bg-background/70 px-3 py-2 pl-4 shadow-[0_10px_40px_-15px_rgba(0,0,0,0.6)] backdrop-blur-xl md:px-4 md:py-2.5 md:pl-6">
        <a href="#" className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-full bg-cream text-primary-foreground font-display text-sm font-bold">M</span>
          <span className="font-display text-base font-semibold tracking-tight">Makanye<span className="text-accent">.</span></span>
        </a>
        <nav className="hidden md:flex items-center gap-7 text-sm text-muted-foreground">
          {links.map((l) => (
            <a key={l.href} href={l.href} className="transition hover:text-foreground">{l.label}</a>
          ))}
        </nav>
        <a href="#booking" className="hidden md:inline-flex items-center gap-2 rounded-full bg-cream px-4 py-1.5 text-sm font-medium text-primary-foreground transition hover:opacity-90">
          Book
        </a>
        <button
          aria-label="Menu"
          onClick={() => setOpen((v) => !v)}
          className="md:hidden grid h-9 w-9 place-items-center rounded-full border border-border/60"
        >
          <div className="space-y-1.5">
            <span className={`block h-px w-4 bg-foreground transition ${open ? "translate-y-1.5 rotate-45" : ""}`} />
            <span className={`block h-px w-4 bg-foreground transition ${open ? "-translate-y-1 -rotate-45" : ""}`} />
          </div>
        </button>
      </div>
      {open && (
        <div className="md:hidden mt-2 rounded-2xl border border-border/50 bg-background/90 backdrop-blur-xl shadow-xl animate-fade-in">
          <div className="flex flex-col px-5 py-4">
            {links.map((l) => (
              <a key={l.href} href={l.href} onClick={() => setOpen(false)} className="py-3 text-base text-muted-foreground hover:text-foreground">
                {l.label}
              </a>
            ))}
            <a href="#booking" onClick={() => setOpen(false)} className="mt-2 inline-flex items-center justify-center rounded-full bg-cream px-5 py-3 text-sm font-medium text-primary-foreground">
              Book a chair
            </a>
          </div>
        </div>
      )}
    </header>
  );
}

function Hero() {
  return (
    <section className="relative px-5 pt-20 pb-24 md:px-8 md:pt-28 md:pb-36">
      <div className="mx-auto max-w-5xl text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/40 px-4 py-1.5 text-xs text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 text-accent" />
          Braids · Locs · Natural Hair · Nairobi
        </div>
        <h1 className="mt-6 font-display text-5xl font-semibold leading-[0.95] sm:text-6xl md:text-7xl lg:text-8xl">
          <span className="block">Bespoke hair</span>
          <span className="block">artistry for</span>
          <span className="block text-gradient-gold italic">African crowns.</span>
        </h1>
        <p className="mx-auto mt-7 max-w-xl text-base text-muted-foreground md:text-lg">
          Hair by Makanye is a Nairobi studio dedicated to protective styling, locs and editorial finishes — built around your hair, your story and your time.
        </p>
        <div className="mt-9 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <a href="#booking" className="inline-flex items-center gap-2 rounded-full bg-cream px-6 py-3 text-sm font-medium text-primary-foreground transition hover:opacity-90">
            Book a chair <ArrowRight className="h-4 w-4" />
          </a>
          <a href="#services" className="text-sm text-foreground/80 hover:text-foreground">Explore the menu</a>
        </div>

        <div className="mt-20 grid grid-cols-3 gap-6 md:gap-12">
          {[
            { k: "Bespoke", v: "Every chair" },
            { k: "8+ yrs", v: "Hands-on craft" },
            { k: "Nairobi", v: "Studio & on-location" },
          ].map((s) => (
            <div key={s.k} className="text-left md:text-center">
              <div className="font-display text-3xl font-semibold md:text-4xl">{s.k}</div>
              <div className="mt-1 text-xs text-muted-foreground md:text-sm">{s.v}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Marquee() {
  const items = ["Knotless", "Boho Braids", "Sisterlocks", "Silk Press", "Passion Twists", "Bridal", "Cornrows", "Retwist", "Editorial"];
  return (
    <div className="border-y border-border/40 bg-background/40 py-5 overflow-hidden">
      <div className="flex animate-[scroll_30s_linear_infinite] gap-12 whitespace-nowrap font-display text-xl text-muted-foreground">
        {[...items, ...items, ...items].map((t, i) => (
          <span key={i} className="flex items-center gap-12">
            {t}
            <span className="text-accent">✦</span>
          </span>
        ))}
      </div>
      <style>{`@keyframes scroll{from{transform:translateX(0)}to{transform:translateX(-50%)}}`}</style>
    </div>
  );
}

function About() {
  return (
    <section id="about" className="px-5 py-24 md:px-8 md:py-32">
      <div className="mx-auto max-w-5xl">
        <div className="text-xs uppercase tracking-[0.2em] text-accent">About</div>
        <h2 className="mt-4 font-display text-3xl font-semibold leading-tight sm:text-4xl md:text-5xl">
          We honour the texture, the time and the story behind every style.
        </h2>
        <p className="mt-6 max-w-2xl text-base text-muted-foreground md:text-lg">
          Makanye is a hair artist working out of Nairobi. The studio is intimate by design — one client at a time, generous appointments, and styling rooted in healthy hair practice. From a refresh retwist to a full bridal crown, every visit is built around you.
        </p>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {principles.map((p) => (
            <div key={p.title} className="rounded-2xl border border-border/60 bg-card/40 p-6 backdrop-blur">
              <h3 className="font-display text-xl font-semibold">{p.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{p.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Services() {
  return (
    <section id="services" className="px-5 py-24 md:px-8 md:py-32">
      <div className="mx-auto max-w-6xl">
        <div className="text-xs uppercase tracking-[0.2em] text-accent">The Menu</div>
        <h2 className="mt-4 font-display text-3xl font-semibold leading-tight sm:text-4xl md:text-5xl max-w-3xl">
          A focused menu, crafted around protective styling and natural hair.
        </h2>
        <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {services.map((s) => (
            <article key={s.name} className="group relative flex flex-col rounded-2xl border border-border/60 bg-card/40 p-6 backdrop-blur transition hover:border-accent/40">
              <div className="flex items-start justify-between gap-4">
                <h3 className="font-display text-2xl font-semibold leading-tight">{s.name}</h3>
                <span className="shrink-0 rounded-full border border-border/60 px-3 py-1 text-xs text-muted-foreground">
                  from {s.from}
                </span>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">{s.desc}</p>
              <div className="mt-5 flex flex-wrap gap-2">
                {s.tags.map((t) => (
                  <span key={t} className="rounded-full bg-secondary/60 px-3 py-1 text-xs text-foreground/80">{t}</span>
                ))}
              </div>
              <a href="#booking" className="mt-6 inline-flex items-center gap-2 text-sm text-accent transition group-hover:gap-3">
                Book this service <ArrowRight className="h-4 w-4" />
              </a>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function Why() {
  const points = [
    "Healthy-hair first — tension-aware, scalp-friendly methods",
    "One client at a time — no rushed chairs, no overlap",
    "Editorial finish — colour, shape and detail considered",
    "Transparent pricing & realistic timing communicated up front",
  ];
  return (
    <section id="why" className="px-5 py-24 md:px-8 md:py-32">
      <div className="mx-auto grid max-w-6xl gap-12 md:grid-cols-2 md:items-center">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-accent">Why Makanye</div>
          <h2 className="mt-4 font-display text-3xl font-semibold leading-tight sm:text-4xl md:text-5xl">
            A chair built on care, conviction and craft.
          </h2>
          <p className="mt-6 text-muted-foreground">
            The work is slow on purpose. Clean parting, deliberate tension, the right product for your texture — small choices that change how a style wears, week after week.
          </p>
        </div>
        <ul className="space-y-4">
          {points.map((p) => (
            <li key={p} className="flex items-start gap-4 rounded-xl border border-border/60 bg-card/40 p-5 backdrop-blur">
              <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent/20 text-accent">
                <Check className="h-4 w-4" />
              </span>
              <span className="text-sm text-foreground/90">{p}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Booking() {
  const [submitted, setSubmitted] = useState(false);
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitted(true);
    toast.success("Booking request sent. Makanye will be in touch shortly.");
  };
  const today = new Date().toISOString().split("T")[0];
  return (
    <section id="booking" className="px-5 py-24 md:px-8 md:py-32">
      <div className="mx-auto max-w-3xl">
        <div className="rounded-3xl border border-border/60 bg-card/50 p-6 backdrop-blur md:p-12">
          <div className="text-xs uppercase tracking-[0.2em] text-accent">Book a chair</div>
          <h2 className="mt-4 font-display text-3xl font-semibold leading-tight sm:text-4xl md:text-5xl">
            Reserve your appointment.
          </h2>
          <p className="mt-4 text-muted-foreground">
            Tell us about your hair and the style you have in mind. We'll confirm timing, pricing and prep within 24 hours.
          </p>

          {submitted ? (
            <div className="mt-8 rounded-2xl border border-accent/40 bg-accent/10 p-6 text-center">
              <Sparkles className="mx-auto h-6 w-6 text-accent" />
              <p className="mt-3 font-display text-2xl">Request received</p>
              <p className="mt-2 text-sm text-muted-foreground">Look out for a WhatsApp or email from Makanye soon.</p>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="mt-8 grid gap-5 sm:grid-cols-2">
              <Field label="Full name" name="name" required />
              <Field label="Phone / WhatsApp" name="phone" type="tel" required />
              <Field label="Email" name="email" type="email" required className="sm:col-span-2" />
              <SelectField label="Service" name="service" options={services.map((s) => s.name)} />
              <Field label="Preferred date" name="date" type="date" min={today} />
              <div className="sm:col-span-2">
                <label className="mb-2 block text-xs uppercase tracking-wider text-muted-foreground">Tell us about your hair & style</label>
                <textarea
                  name="notes"
                  rows={4}
                  placeholder="Current length, last service, inspiration..."
                  className="w-full rounded-xl border border-border/60 bg-input/40 px-4 py-3 text-sm outline-none transition focus:border-accent/60"
                />
              </div>
              <button
                type="submit"
                className="sm:col-span-2 inline-flex items-center justify-center gap-2 rounded-full bg-cream px-6 py-3.5 text-sm font-medium text-primary-foreground transition hover:opacity-90"
              >
                Send booking request <ArrowRight className="h-4 w-4" />
              </button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}

function Field({ label, name, type = "text", required, className = "", min }: { label: string; name: string; type?: string; required?: boolean; className?: string; min?: string }) {
  return (
    <div className={className}>
      <label className="mb-2 block text-xs uppercase tracking-wider text-muted-foreground">{label}</label>
      <input
        name={name}
        type={type}
        required={required}
        min={min}
        className="w-full rounded-xl border border-border/60 bg-input/40 px-4 py-3 text-sm outline-none transition focus:border-accent/60"
      />
    </div>
  );
}

function SelectField({ label, name, options }: { label: string; name: string; options: string[] }) {
  return (
    <div>
      <label className="mb-2 block text-xs uppercase tracking-wider text-muted-foreground">{label}</label>
      <select
        name={name}
        className="w-full rounded-xl border border-border/60 bg-input/40 px-4 py-3 text-sm outline-none transition focus:border-accent/60"
      >
        {options.map((o) => (
          <option key={o} value={o} className="bg-background">{o}</option>
        ))}
      </select>
    </div>
  );
}

function Contact() {
  return (
    <section id="contact" className="px-5 py-24 md:px-8 md:py-32">
      <div className="mx-auto max-w-5xl">
        <div className="text-xs uppercase tracking-[0.2em] text-accent">Contact</div>
        <h2 className="mt-4 font-display text-3xl font-semibold leading-tight sm:text-4xl md:text-5xl max-w-2xl">
          Slide into the studio — or the DMs.
        </h2>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          <ContactCard icon={<Instagram className="h-5 w-5" />} label="Instagram" value="@hairbymakanye" href="https://www.instagram.com/hairbymakanye/" />
          <ContactCard icon={<Mail className="h-5 w-5" />} label="Email" value="hello@makanye.studio" href="mailto:hello@makanye.studio" />
          <ContactCard icon={<MapPin className="h-5 w-5" />} label="Studio" value="Nairobi, Kenya" />
        </div>
      </div>
    </section>
  );
}

function ContactCard({ icon, label, value, href }: { icon: React.ReactNode; label: string; value: string; href?: string }) {
  const Comp: any = href ? "a" : "div";
  return (
    <Comp href={href} target={href?.startsWith("http") ? "_blank" : undefined} rel="noreferrer" className="group flex items-start gap-4 rounded-2xl border border-border/60 bg-card/40 p-6 backdrop-blur transition hover:border-accent/40">
      <span className="grid h-10 w-10 place-items-center rounded-full bg-accent/15 text-accent">{icon}</span>
      <div>
        <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="mt-1 font-display text-lg">{value}</div>
      </div>
    </Comp>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border/40 px-5 py-10 md:px-8">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 text-xs text-muted-foreground md:flex-row">
        <div>© {new Date().getFullYear()} Hair by Makanye. All rights reserved.</div>
        <div className="flex items-center gap-2">
          <Phone className="h-3 w-3" /> Bookings by appointment only · Nairobi
        </div>
      </div>
    </footer>
  );
}
