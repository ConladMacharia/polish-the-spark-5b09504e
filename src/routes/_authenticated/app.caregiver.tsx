import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LogOut, PlayCircle, HeartPulse, BookOpen, LineChart, Loader2, Sparkles } from "lucide-react";
import { useState } from "react";

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
  const [launching, setLaunching] = useState<string | null>(null);

  const { data: profile } = useQuery({
    queryKey: ["me-profile"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("full_name, preferred_language")
        .eq("id", userData.user.id)
        .maybeSingle();
      return data;
    },
  });

  const { data: patient } = useQuery({
    queryKey: ["my-patient"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) return null;

      // Reuse existing self-managed or claimed patient
      const { data: existing } = await supabase
        .from("patients")
        .select("*")
        .eq("claimed_by_caregiver_id", uid)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (existing) return existing;

      // Auto-provision a self-managed patient
      const { data: prof } = await supabase
        .from("profiles")
        .select("full_name, preferred_language")
        .eq("id", uid)
        .maybeSingle();
      const childName = prof?.full_name ? `${prof.full_name.split(" ")[0]}'s child` : "My child";
      const { data: created, error } = await supabase
        .from("patients")
        .insert({
          claimed_by_caregiver_id: uid,
          claimed_at: new Date().toISOString(),
          child_name: childName,
          affected_side: "bilateral",
          preferred_language: (prof?.preferred_language as "en" | "sw" | "ki") ?? "en",
          goals: [],
          claim_code: cryptoRandomCode(),
        })
        .select()
        .single();
      if (error) throw error;
      return created;
    },
  });

  async function handleSignOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  async function launchTherapy(hash: string) {
    if (!patient) return;
    setLaunching(hash);
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token ?? "";
    const userId = data.session?.user.id ?? "";
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
    const apikey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
    const params = new URLSearchParams({
      patient: patient.id,
      caregiver: userId,
      token,
      url: supabaseUrl,
      apikey,
    });
    window.location.href = `/neuro-bridge/index.html#${params.toString()}${hash ? `&nav=${hash}` : ""}`;
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
            {patient
              ? `Sessions for ${patient.child_name} save automatically so your therapist can review progress.`
              : "Setting up your child's profile…"}
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <button
            type="button"
            disabled={!patient}
            onClick={() => launchTherapy("")}
            className="group rounded-3xl border border-border bg-gradient-to-br from-primary to-primary/70 p-6 text-left text-primary-foreground shadow-md transition-transform hover:-translate-y-0.5 disabled:opacity-70"
          >
            {launching === "" ? <Loader2 className="h-8 w-8 animate-spin" /> : <PlayCircle className="h-8 w-8" />}
            <p className="mt-4 font-display text-2xl">Start therapy</p>
            <p className="mt-1 text-sm opacity-90">
              Guided PT & OT exercises in your language.
            </p>
          </button>

          <button
            type="button"
            disabled={!patient}
            onClick={() => launchTherapy("libraryScreen")}
            className="rounded-3xl border border-border bg-card p-6 text-left shadow-sm transition-transform hover:-translate-y-0.5 disabled:opacity-70"
          >
            <BookOpen className="h-8 w-8 text-primary" />
            <p className="mt-4 font-display text-2xl">Reference library</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Video guides for each exercise.
            </p>
          </button>

          <button
            type="button"
            disabled={!patient}
            onClick={() => launchTherapy("progressScreen")}
            className="rounded-3xl border border-border bg-card p-6 text-left shadow-sm transition-transform hover:-translate-y-0.5 disabled:opacity-70"
          >
            <LineChart className="h-8 w-8 text-primary" />
            <p className="mt-4 font-display text-2xl">Progress</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Track how sessions are going day by day.
            </p>
          </button>

          <button
            type="button"
            onClick={() => navigate({ to: "/app/exercises" })}
            className="rounded-3xl border border-border bg-card p-6 text-left shadow-sm transition-transform hover:-translate-y-0.5"
          >
            <Sparkles className="h-8 w-8 text-primary" />
            <p className="mt-4 font-display text-2xl">Exercise library</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Browse all physiotherapy & occupational exercises for CP.
            </p>
          </button>

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

function cryptoRandomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  const arr = new Uint8Array(8);
  crypto.getRandomValues(arr);
  for (let i = 0; i < 8; i++) out += chars[arr[i] % chars.length];
  return out;
}
