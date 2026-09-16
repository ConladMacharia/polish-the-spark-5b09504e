import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LogOut, PlayCircle, Flame, ShieldAlert, Rocket, Home, Dumbbell, Video, User, Globe } from "lucide-react";
import { useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { LanguageSettings } from "@/components/LanguageSettings";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { RafikiIsland } from "@/components/child/RafikiIsland";
import { ChildProfileSheet } from "@/components/child/ChildProfileSheet";
import { AmbientBlobs, BottomNav, GlassCard } from "@/components/ui/glass";


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

type NavId = "home" | "library" | "videos" | "profile";

function CaregiverHome() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { t } = useLanguage();
  const [uxMode, setUxMode] = useState<"caregiver" | "child">("caregiver");
  const [profileOpen, setProfileOpen] = useState(false);


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

  function handleNav(id: NavId) {
    if (id === "library") return navigate({ to: "/app/exercises" });
    if (id === "videos") return navigate({ to: "/app/training" });
    if (id === "profile") return setProfileOpen(true);
    // "home" — already here, no-op
  }

  const firstName = profile?.full_name?.split(" ")[0] ?? "Caregiver";
  const childName = patient?.child_name ?? "Amani";

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-emerald-950 via-[#05100c] to-emerald-950 text-stone-50">
      <AmbientBlobs />

      {/* Caregiver / child mode switch */}
      <div className="relative z-10 mx-auto max-w-4xl px-6 pt-5">
        <div className="flex rounded-full border border-white/15 bg-white/10 p-1 backdrop-blur-xl sm:inline-flex">
          <button
            type="button"
            onClick={() => setUxMode("caregiver")}
            className={`flex-1 rounded-full px-4 py-1.5 font-display text-[13px] font-semibold transition-colors sm:flex-none ${
              uxMode === "caregiver" ? "bg-emerald-300 text-emerald-950" : "text-stone-200"
            }`}
          >
            {t("caregiverUx")}
          </button>
          <button
            type="button"
            onClick={() => setUxMode("child")}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-full px-4 py-1.5 font-display text-[13px] font-semibold transition-colors sm:flex-none ${
              uxMode === "child" ? "bg-emerald-300 text-emerald-950" : "text-stone-200"
            }`}
          >
            <Rocket className="h-3.5 w-3.5" /> {t("childUx")}
          </button>
        </div>
      </div>

      {uxMode === "caregiver" ? (
        <div className="relative z-10 mx-auto flex min-h-[calc(100vh-4.5rem)] max-w-4xl flex-col px-6 pb-4 pt-5">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-display text-2xl font-bold tracking-tight text-stone-50">
                {t("greeting", { name: firstName })} <span className="inline-block animate-bounce">👋</span>
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <LanguageSettings />
              <button
                type="button"
                onClick={handleSignOut}
                aria-label={t("signOut")}
                className="grid h-10 w-10 place-items-center rounded-full border border-white/15 bg-white/10 backdrop-blur-xl"
              >
                <LogOut className="h-4 w-4 text-emerald-200" />
              </button>
            </div>
          </div>

          {/* Today's mission — hero card */}
          <GlassCard tint="emerald" className="mt-5" onClick={goToExercises} as="button">
            <div className="p-5 text-left">
              <span className="inline-block rounded-full bg-white/10 px-3 py-1 font-display text-[11px] font-semibold tracking-wide text-emerald-200">
                {t("todaysMission")}
              </span>
              <h2 className="mt-3 font-display text-2xl font-bold leading-snug text-stone-50">
                {t("startTodaySession")}
              </h2>
              <p className="mt-1.5 text-[13px] font-medium text-stone-300">{t("sessionDescription")}</p>
              <div className="mt-3 flex flex-wrap gap-3 text-[12px] font-semibold text-stone-300">
                <span>🎯 {t("threeExercises")}</span>
                <span>⏱ {t("twelveMinutes")}</span>
                <span>📶 {t("gmfcsBadge")}</span>
              </div>
              <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-emerald-300 px-5 py-2.5 font-display text-sm font-bold text-emerald-950">
                <PlayCircle className="h-4 w-4" />
                {t("beginSession")}
              </div>
            </div>
          </GlassCard>

          {/* Toolkit grid */}
          <p className="mt-6 font-display text-[13px] font-semibold uppercase tracking-wide text-emerald-300">
            {t("yourToolkit")}
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <GlassCard tint="emerald" as="button" onClick={goToExercises} className="p-4 text-left">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-300/90">
                <Dumbbell className="h-5 w-5 text-emerald-950" />
              </div>
              <h4 className="mt-3 font-display text-base font-bold text-stone-50">{t("exerciseLibrary")}</h4>
              <p className="mt-0.5 text-[12px] font-medium text-stone-300">{t("exerciseLibrarySub")}</p>
            </GlassCard>

            <GlassCard
              tint="neutral"
              as="button"
              onClick={() => navigate({ to: "/app/training" })}
              className="p-4 text-left"
            >
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-300/90">
                <Video className="h-5 w-5 text-emerald-950" />
              </div>
              <h4 className="mt-3 font-display text-base font-bold text-stone-50">{t("trainingFilms")}</h4>
              <p className="mt-0.5 text-[12px] font-medium text-stone-300">{t("trainingFilmsSub")}</p>
            </GlassCard>

            <GlassCard tint="dark" className="flex items-center gap-4 p-4 sm:col-span-2">
              <div className="flex items-center gap-1.5 font-display text-2xl font-bold text-emerald-200">
                <Flame className="h-6 w-6 fill-emerald-300 text-emerald-300" /> 5
              </div>
              <div className="h-9 w-px bg-white/10" />
              <div>
                <p className="text-[11px] font-semibold uppercase text-stone-400">{t("lastSession")}</p>
                <p className="font-display text-sm font-bold text-stone-50">{t("lastSessionValue")}</p>
              </div>
            </GlassCard>
          </div>

          {/* Tip card */}
          <GlassCard tint="neutral" className="mt-3 flex items-start gap-3 p-4">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" />
            <div>
              <p className="font-display text-[11px] font-semibold uppercase tracking-wide text-emerald-300">
                {t("tip")}
              </p>
              <h5 className="mt-0.5 font-display text-sm font-bold text-stone-50">{t("tipTitle")}</h5>
              <p className="mt-1 text-[12px] font-medium leading-relaxed text-stone-300">{t("tipBody")}</p>
            </div>
          </GlassCard>

          <div className="mt-auto" />
        </div>
      ) : (
        /* CHILD UX MODE — Rafiki's Island */
        <RafikiIsland childName={childName} />
      )}

      {uxMode === "caregiver" && (
        <div className="sticky bottom-0 z-10">
          <BottomNav<NavId>
            items={[
              { id: "home", icon: Home, label: t("home") },
              { id: "library", icon: Dumbbell, label: "Tracking" },
              { id: "videos", icon: Video, label: "Videos" },
              { id: "profile", icon: User, label: "You" },
            ]}
            active="home"
            onChange={handleNav}
          />
        </div>
      )}

      <ChildProfileSheet
        open={profileOpen}
        onOpenChange={setProfileOpen}
        patient={patient as never}
      />
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
