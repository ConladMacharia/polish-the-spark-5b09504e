import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LogOut, PlayCircle, HeartPulse, BookOpen, LineChart } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/app/caregiver")({
  head: () => ({
    meta: [{ title: "Home — Neuro-Bridge" }],
  }),
  component: CaregiverHome,
});

function CaregiverHome() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: profile } = useQuery({
    queryKey: ["me-profile"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", userData.user.id)
        .maybeSingle();
      return data;
    },
  });

  async function handleSignOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const firstName = profile?.full_name?.split(" ")[0] ?? "caregiver";

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/60 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground font-display text-lg">
              N
            </span>
            <div>
              <p className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
                <HeartPulse className="h-4 w-4" /> Caregiver
              </p>
              <p className="font-display text-lg leading-none">Home</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={handleSignOut}>
            <LogOut className="mr-2 h-4 w-4" /> Sign out
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-8">
        <div className="mb-6">
          <h1 className="font-display text-3xl">Karibu, {firstName} 👋</h1>
          <p className="text-sm text-muted-foreground">
            Choose a therapy game and begin today's session — no code needed.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <a
            href="/neuro-bridge/index.html"
            className="group rounded-3xl border border-border bg-gradient-to-br from-primary to-primary/70 p-6 text-primary-foreground shadow-md transition-transform hover:-translate-y-0.5"
          >
            <PlayCircle className="h-8 w-8" />
            <p className="mt-4 font-display text-2xl">Start therapy</p>
            <p className="mt-1 text-sm opacity-90">
              Guided PT & OT exercises in your language.
            </p>
          </a>

          <a
            href="/neuro-bridge/index.html#libraryScreen"
            className="rounded-3xl border border-border bg-card p-6 shadow-sm transition-transform hover:-translate-y-0.5"
          >
            <BookOpen className="h-8 w-8 text-primary" />
            <p className="mt-4 font-display text-2xl">Reference library</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Video guides for each exercise.
            </p>
          </a>

          <a
            href="/neuro-bridge/index.html#progressScreen"
            className="rounded-3xl border border-border bg-card p-6 shadow-sm transition-transform hover:-translate-y-0.5"
          >
            <LineChart className="h-8 w-8 text-primary" />
            <p className="mt-4 font-display text-2xl">Progress</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Track how sessions are going day by day.
            </p>
          </a>

          <div className="rounded-3xl border border-dashed border-border bg-card p-6">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Tip
            </p>
            <p className="mt-2 font-display text-xl">Set up beside your child</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Prop the phone or tablet so the whole body is visible. Stop if
              there's pain, dizziness or unusual fatigue.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
