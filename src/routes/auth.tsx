import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Admin Sign In — Hair by Makanye" }, { name: "robots", content: "noindex" }] }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email, password, options: { emailRedirectTo: window.location.origin + "/admin" },
        });
        if (error) throw error;
        toast.success("Account created. You can sign in.");
        setMode("signin");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Signed in");
        navigate({ to: "/admin" });
      }
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed"); }
    finally { setBusy(false); }
  };

  return (
    <main className="min-h-screen px-5 py-16 md:px-8">
      <div className="mx-auto max-w-sm">
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">← Back</Link>
        <h1 className="mt-6 font-display text-3xl font-semibold">Admin {mode === "signup" ? "sign up" : "sign in"}</h1>
        <p className="mt-1 text-sm text-muted-foreground">The first account to sign up becomes the admin.</p>

        <form onSubmit={onSubmit} className="mt-6 grid gap-3 rounded-2xl border border-border/50 bg-background/40 p-5">
          <label className="block">
            <span className="text-xs text-muted-foreground">Email</span>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border/50 bg-background/60 px-3 py-2 text-sm outline-none focus:border-accent" />
          </label>
          <label className="block">
            <span className="text-xs text-muted-foreground">Password</span>
            <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border/50 bg-background/60 px-3 py-2 text-sm outline-none focus:border-accent" />
          </label>
          <button disabled={busy} className="mt-2 inline-flex items-center justify-center gap-2 rounded-full bg-cream px-5 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-60">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} {mode === "signup" ? "Create account" : "Sign in"}
          </button>
          <button type="button" onClick={() => setMode(mode === "signup" ? "signin" : "signup")} className="text-xs text-muted-foreground hover:text-foreground">
            {mode === "signup" ? "Already have an account? Sign in" : "No account yet? Sign up"}
          </button>
        </form>
      </div>
    </main>
  );
}
