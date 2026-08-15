import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LogOut, PlayCircle, Flame, ShieldAlert, Star, Rocket } from "lucide-react";
import { useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LanguageSettings } from "@/components/LanguageSettings";
import { useLanguage } from "@/lib/i18n/LanguageProvider";

export const Route = createFileRoute("/_authenticated/app/caregiver")({
  head: () => ({
    meta: [
      { title: "Caregiver home — Neuro-Bridge" },
      {
        name: "description",
        content:
          "Launch today's therapist-prescribed session, browse the exercise library, and switch the app into any of 43 Kenyan languages.",
      },
      { property: "og:title", content: "Caregiver home — Neuro-Bridge" },
      {
        property: "og:description",
        content: "Guided home therapy for children with cerebral palsy, in your own language.",
      },
    ],
  }),
  component: CaregiverHome,
});

function CaregiverHome() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { t } = useLanguage();
  const [uxMode, setUxMode] = useState<"caregiver" | "child">("caregiver");

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

      const { data: existing } = await supabase
        .from("patients")
        .select("*")
        .eq("claimed_by_caregiver_id", uid)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (existing) return existing;

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

  function goToExercises() {
    navigate({ to: "/app/exercises" });
  }

  const firstName = profile?.full_name?.split(" ")[0] ?? "Caregiver";
  const childName = patient?.child_name ?? "Amani";

  return (
    <div
      className={`min-h-screen ${uxMode === "child" ? "bg-amber-50 text-slate-900" : "bg-background"}`}
    >
      {/* Dual Mode Bar */}
      <div className="bg-slate-900 text-white px-6 py-2.5 flex items-center justify-between text-xs font-semibold">
        <span className="tracking-wide">NEURO-BRIDGE</span>
        <div className="inline-flex rounded-full bg-white/10 p-1 gap-1">
          <button
            type="button"
            onClick={() => setUxMode("caregiver")}
            className={`rounded-full px-3 py-1 transition ${uxMode === "caregiver"
                ? "bg-amber-400 text-slate-950 font-bold"
                : "text-white hover:text-amber-200"
              }`}
          >
            {t("caregiverUx")}
          </button>
          <button
            type="button"
            onClick={() => setUxMode("child")}
            className={`rounded-full px-3 py-1 transition flex items-center gap-1 ${uxMode === "child"
                ? "bg-purple-600 text-white font-bold"
                : "text-white hover:text-purple-300"
              }`}
          >
            <Rocket className="h-3 w-3" /> {t("childUx")} 🚀
          </button>
        </div>
      </div>

      {uxMode === "caregiver" ? (
        /* CAREGIVER BROWSE MODE */
        <div>
          <header className="border-b border-border bg-card/60 backdrop-blur">
            <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 rounded-full border-2 border-slate-900 bg-amber-100 px-3 py-1 shadow-[2px_2px_0px_#0f172a]">
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-pink-500 text-white font-bold text-xs">
                    {childName.charAt(0)}
                  </span>
                  <span className="text-xs font-extrabold text-slate-900">
                    {childName}, {t("ageLabel")} ▾
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <LanguageSettings />
                <Button variant="ghost" size="sm" onClick={handleSignOut}>
                  <LogOut className="mr-2 h-4 w-4" /> {t("signOut")}
                </Button>
              </div>
            </div>
          </header>

          <main className="mx-auto max-w-4xl px-6 py-8">
            <div className="mb-6">
              <h1 className="font-display text-4xl text-slate-900 tracking-tight flex items-center gap-2">
                {t("greeting", { name: firstName })}{" "}
                <span className="inline-block animate-bounce">👋</span>
              </h1>
              <p className="mt-1 text-sm font-semibold text-slate-600">
                {t("todayPlanReady")} —{" "}
                <span className="text-blue-600 font-bold">{t("planSummary")}</span>
              </p>
            </div>

            {/* Primary Action Card (Dominant) */}
            <div
              onClick={goToExercises}
              className="relative overflow-hidden rounded-3xl border-4 border-slate-950 bg-gradient-to-br from-blue-600 to-blue-800 p-6 text-white shadow-[6px_6px_0px_#0f172a] cursor-pointer transition-transform active:translate-x-1 active:translate-y-1 active:shadow-[2px_2px_0px_#0f172a] mb-6"
            >
              <span className="inline-block rounded-lg bg-white/20 px-3 py-1 font-display text-xs tracking-wider uppercase mb-3">
                {t("todaysMission")}
              </span>
              <h2 className="font-display text-3xl font-bold">{t("startTodaySession")}</h2>
              <p className="mt-1 text-sm opacity-90 font-medium">{t("sessionDescription")}</p>
              <div className="mt-4 flex flex-wrap gap-4 text-xs font-extrabold opacity-95">
                <span>🎯 {t("threeExercises")}</span>
                <span>⏱ {t("twelveMinutes")}</span>
                <span>📶 {t("gmfcsBadge")}</span>
              </div>
              <div className="mt-6 inline-flex items-center gap-2 rounded-xl border-2 border-slate-950 bg-yellow-400 px-5 py-3 font-display font-extrabold text-slate-950 shadow-[3px_3px_0px_rgba(0,0,0,0.3)]">
                <PlayCircle className="h-5 w-5 fill-slate-950 text-yellow-400" />{" "}
                {t("beginSession")}
              </div>
            </div>

            {/* Toolkit Grid (2-column) */}
            <div className="mb-3">
              <h3 className="font-display text-sm uppercase tracking-wider text-slate-500 font-bold">
                {t("yourToolkit")}
              </h3>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 mb-6">
              <button
                type="button"
                onClick={() => navigate({ to: "/app/exercises" })}
                className="rounded-2xl border-3 border-slate-950 bg-amber-50 p-5 text-left shadow-[4px_4px_0px_#0f172a] transition-transform active:translate-x-0.5 active:translate-y-0.5"
              >
                <div className="flex h-16 w-16 flex-col justify-center rounded-xl border-2 border-slate-950 bg-lime-400 p-1.5 text-[6px] font-black uppercase leading-3 text-slate-900">
                  <span>{"\n"}</span>
                  <span className="ml-1 mt-0.5 text-[5px] font-semibold normal-case leading-3">
                    {"\n"}
                  </span>
                  <span className="mt-1">{"\n"}</span>
                </div>
                <h4 className="mt-3 font-display text-lg font-bold text-slate-900">
                  {t("exerciseLibrary")}
                </h4>
                <p className="mt-0.5 text-xs text-slate-600 font-semibold">
                  {t("exerciseLibrarySub")}
                </p>
              </button>

              <button
                type="button"
                onClick={() => navigate({ to: "/app/training" })}
                className="rounded-2xl border-3 border-slate-950 bg-amber-50 p-5 text-left shadow-[4px_4px_0px_#0f172a] transition-transform active:translate-x-0.5 active:translate-y-0.5"
              >
                <div className="grid h-16 w-16 place-items-center rounded-xl border-2 border-slate-950 bg-sky-300 text-3xl">
                  🎬
                </div>
                <h4 className="mt-3 font-display text-lg font-bold text-slate-900">
                  Training videos
                </h4>
                <p className="mt-0.5 text-xs text-slate-600 font-semibold">
                  Short guided demos for every exercise
                </p>
              </button>

              <div className="sm:col-span-2 flex items-center gap-4 rounded-2xl border-3 border-slate-950 bg-amber-50 p-5 shadow-[4px_4px_0px_#0f172a]">
                <div className="flex items-center gap-1.5 font-display text-3xl font-bold text-pink-600">
                  <Flame className="h-7 w-7 text-pink-500 fill-pink-500" /> 5
                </div>
                <div className="h-10 w-0.5 bg-slate-300" />
                <div>
                  <p className="text-xs font-extrabold uppercase text-slate-500">
                    {t("lastSession")}
                  </p>
                  <p className="font-display text-base text-slate-900 font-bold">
                    {t("lastSessionValue")}
                  </p>
                </div>
              </div>
            </div>

            {/* Tip Card (Dashed Border) */}
            <div className="rounded-2xl border-3 border-dashed border-slate-950 bg-amber-100/70 p-5 flex gap-3 items-start">
              <ShieldAlert className="h-6 w-6 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-display text-xs uppercase tracking-wider text-amber-800 font-extrabold">
                  {t("tip")}
                </p>
                <h5 className="font-display text-base text-slate-900 font-bold mt-0.5">
                  {t("tipTitle")}
                </h5>
                <p className="mt-1 text-xs font-semibold text-slate-700 leading-relaxed">
                  {t("tipBody")}
                </p>
              </div>
            </div>
          </main>
        </div>
      ) : (
        /* CHILD UX MODE — Rafiki's Island */
        <RafikiIsland childName={childName} />
      )}
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
