import { createFileRoute, Link } from "@tanstack/react-router";
import { Activity, HeartHandshake, Languages, ShieldCheck, Sparkles } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Neuro-Bridge — Home therapy for children with cerebral palsy" },
      {
        name: "description",
        content:
          "Therapist-prescribed physiotherapy at home for children with cerebral palsy, with AI form guidance in English, Kiswahili, and Gikuyu.",
      },
      { property: "og:title", content: "Neuro-Bridge" },
      {
        property: "og:description",
        content:
          "Therapist-prescribed home physiotherapy for children with cerebral palsy, guided by AI form feedback.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Link to="/" className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground font-display text-lg">
            N
          </span>
          <span className="font-display text-xl">
            Neuro-Bridge <span className="flag" role="img" aria-label="Kenyan flag">🇰🇪</span>
          </span>
        </Link>
        <Link
          to="/auth"
          className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
        >
          Sign in
        </Link>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(60% 50% at 50% 0%, color-mix(in oklab, var(--primary) 18%, transparent) 0%, transparent 70%)",
          }}
        />
        <div className="mx-auto grid max-w-6xl gap-10 px-6 pb-16 pt-8 md:grid-cols-2 md:pt-16">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground">
              <Sparkles className="h-3.5 w-3.5" /> AI-guided home therapy
            </span>
            <h1 className="mt-5 font-display text-4xl leading-tight text-foreground md:text-6xl">
              Therapy that reaches home.
            </h1>
            <p className="mt-5 max-w-lg text-base text-muted-foreground md:text-lg">
              Neuro-Bridge helps caregivers deliver the exercises a therapist prescribed for
              children with cerebral palsy — with live AI form feedback, in the family's own
              language.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/auth"
                className="rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-md transition-colors hover:bg-primary/90"
              >
                Get started
              </Link>
              <a
                href="#how-it-works"
                className="rounded-full border border-input bg-card px-6 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-accent"
              >
                How it works
              </a>
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-sage" /> Private by design
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Languages className="h-4 w-4 text-sage" /> English · Kiswahili · Gikuyu
              </span>
            </div>
          </div>

          <div className="relative">
            <div className="rounded-3xl border border-border bg-card p-6 shadow-xl">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Today's plan
                  </p>
                  <p className="font-display text-2xl">Amani, age 6</p>
                </div>
                <span className="rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground">
                  GMFCS II
                </span>
              </div>
              <div className="mt-6 space-y-3">
                {[
                  { name: "Arm Raise", target: "8 reps · 45°", ok: true },
                  { name: "Leg Kick (left)", target: "8 reps · hold 2s", ok: true },
                  { name: "Balance Hold", target: "3 × 15s", ok: false },
                ].map((row) => (
                  <div
                    key={row.name}
                    className="flex items-center justify-between rounded-2xl bg-secondary px-4 py-3"
                  >
                    <div>
                      <p className="font-semibold text-secondary-foreground">{row.name}</p>
                      <p className="text-xs text-muted-foreground">{row.target}</p>
                    </div>
                    <span
                      className={`h-2.5 w-2.5 rounded-full ${row.ok ? "bg-sage" : "bg-muted-foreground/40"}`}
                    />
                  </div>
                ))}
              </div>
              <div className="mt-6 flex items-center gap-3 rounded-2xl border border-dashed border-border p-4">
                <Activity className="h-5 w-5 text-primary" />
                <p className="text-xs text-muted-foreground">
                  AI is watching form live — visual halos, gentle voice cues.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="how-it-works" className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid gap-6 md:grid-cols-3">
          {[
            {
              icon: <HeartHandshake className="h-6 w-6" />,
              title: "Prescribed by a therapist",
              body: "Your child's therapist creates a plan tailored to GMFCS level, affected side, and goals. You just follow it at home.",
            },
            {
              icon: <Activity className="h-6 w-6" />,
              title: "AI form guidance",
              body: "Camera-based pose tracking corrects form in real time — no wearables, works on a phone or tablet.",
            },
            {
              icon: <Languages className="h-6 w-6" />,
              title: "Speaks your language",
              body: "Every prompt, video and progress note in English, Kiswahili, or Gikuyu.",
            },
          ].map((f) => (
            <div key={f.title} className="rounded-3xl border border-border bg-card p-6 shadow-sm">
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-accent text-accent-foreground">
                {f.icon}
              </div>
              <h3 className="mt-4 font-display text-xl">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-6 text-xs text-muted-foreground">
          <span>© {new Date().getFullYear()} Neuro-Bridge</span>
          <span>Built for caregivers, therapists and children.</span>
        </div>
      </footer>
    </div>
  );
}
