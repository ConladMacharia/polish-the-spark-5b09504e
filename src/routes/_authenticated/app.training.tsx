import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { PlayCircle, ArrowLeft, Home, Dumbbell, Video, User } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { EXERCISES, translateExercise, type Exercise } from "@/lib/exercise-catalog";
import { LanguageSettings } from "@/components/LanguageSettings";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { ChildProfileSheet } from "@/components/child/ChildProfileSheet";
import { AmbientBlobs, BottomNav, GlassCard } from "@/components/ui/glass";

export const Route = createFileRoute("/_authenticated/app/training")({
  head: () => ({
    meta: [{ title: "Training — Neuro-Bridge" }],
  }),
  component: TrainingPage,
});

type NavId = "home" | "library" | "videos" | "profile";

function TrainingPage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [launching, setLaunching] = useState<string | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);

  const { data: patient } = useQuery({
    queryKey: ["my-patient"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) return null;
      const { data } = await supabase
        .from("patients")
        .select("*")
        .eq("claimed_by_caregiver_id", uid)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  async function launch(slug: string) {
    if (!patient) return;
    setLaunching(slug);
    navigate({ to: "/app/exercises" });
  }

  function handleNav(id: NavId) {
    if (id === "home") return navigate({ to: "/app/caregiver" });
    if (id === "library") return navigate({ to: "/app/exercises" });
    if (id === "profile") return setProfileOpen(true);
    // "videos" — already here, no-op
  }

  const categories = useMemo(
    () => [
      {
        id: "upper",
        label: t("upperBody"),
        icon: "💪",
        track: "arm",
        subcats: [
          {
            id: "shoulder",
            label: t("catShoulder"),
            icon: "🦾",
            items: [
              { slug: "arm", name: t("exForwardReach"), focus: t("focusFlexion") },
              { slug: "arm-circles", name: t("exArmLowering"), focus: t("focusExtension") },
              { slug: "side-bend", name: t("exSideReach"), focus: t("focusAbduction") },
              { slug: "midline", name: t("exCrossBodyReach"), focus: t("focusAdduction") },
              { slug: "wall-slide", name: t("exRotation"), focus: t("focusRotationFull") },
            ],
          },
          {
            id: "elbow",
            label: t("catElbow"),
            icon: "💪",
            items: [
              { slug: "reach", name: t("exBendStraighten"), focus: t("focusFlexionExtension") },
              { slug: "shoulder", name: t("exPalmUpDown"), focus: t("focusSupinationPronation") },
            ],
          },
          {
            id: "wrist",
            label: t("catWrist"),
            icon: "🖐️",
            items: [
              { slug: "draw", name: t("exWristBendUp"), focus: t("focusExtension") },
              { slug: "tracing", name: t("exWristBendDown"), focus: t("focusFlexion") },
              { slug: "page-turn", name: t("exWristTilt"), focus: t("focusRadialUlnar") },
            ],
          },
          { id: "hand", label: t("catHandFingers"), icon: "🤲", keywords: ["hand", "finger", "grasp", "pincer", "thumb"] },
        ],
      },
      {
        id: "lower",
        label: t("lowerBody"),
        icon: "🦵",
        track: "leg",
        subcats: [
          { id: "hip", label: t("catHip"), keywords: ["hip"] },
          { id: "knee", label: t("catKnee"), keywords: ["knee"] },
          { id: "ankle", label: t("catAnkle"), keywords: ["ankle", "foot"] },
          { id: "balance", label: t("catBalance"), keywords: ["balance"] },
        ],
      },
    ],
    [t]
  );

  function findCategory(id: string) {
    return categories.find((c) => c.id === id) ?? null;
  }

  function exercisesForSubcat(catId: string, subId: string) {
    const cat = findCategory(catId);
    if (!cat) return [] as Exercise[];
    const sub: any = cat.subcats.find((s: any) => s.id === subId);
    const track = cat.track;
    const base = EXERCISES.filter((e) => (track === "leg" ? (e.track === "leg" || e.track === "balance") : e.track === track));
    if (!sub) return base;
    if (sub.items) {
      return sub.items.map((it: any) => {
        const found = EXERCISES.find((e) => e.slug === it.slug);
        return { ...(found ?? ({} as Exercise)), slug: it.slug, name: it.name, focus: it.focus, icon: found?.icon ?? "" } as Exercise;
      });
    }
    const keywords: string[] = sub.keywords ?? [];
    const matches = base.filter((e) => {
      const hay = `${e.name} ${e.focus} ${e.description} ${e.slug}`.toLowerCase();
      return keywords.some((k) => hay.includes(k));
    });
    const result = matches.length ? matches : base;
    return result.map((e) => translateExercise(e, t));
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-emerald-950 via-[#05100c] to-emerald-950 pb-4 text-stone-50">
      <AmbientBlobs />

      <header className="sticky top-0 z-30 border-b border-white/10 bg-emerald-950/70 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate({ to: "/app/caregiver" })}
              aria-label="Back to dashboard"
              className="grid h-9 w-9 place-items-center rounded-full border border-white/15 bg-white/10 backdrop-blur-xl"
            >
              <ArrowLeft className="h-4 w-4 text-stone-50" />
            </button>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-300">
                {t("trainingEyebrow")}
              </p>
              <p className="font-display text-lg font-bold text-stone-50">{t("trainingFilms")}</p>
            </div>
          </div>
          <LanguageSettings />
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-5xl space-y-10 px-6 py-8">
        {categories.map((cat) => (
          <section key={cat.id}>
            <div className="mb-4 flex items-center gap-3 border-b border-white/10 pb-3">
              <span className="text-2xl">{cat.icon}</span>
              <h2 className="font-display text-lg font-bold text-stone-50">{cat.label}</h2>
              <span className="ml-auto rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-bold text-emerald-200 backdrop-blur-xl">
                {cat.subcats.reduce(
                  (n: number, s: any) => n + exercisesForSubcat(cat.id, s.id).length,
                  0,
                )}
              </span>
            </div>

            <div className="space-y-6">
              {cat.subcats.map((sub: any) => {
                const items = exercisesForSubcat(cat.id, sub.id);
                if (!items.length) return null;
                return (
                  <div key={sub.id}>
                    <div className="mb-3 flex items-center gap-2">
                      <span className="text-lg">{sub.icon}</span>
                      <h3 className="text-[11px] font-semibold uppercase tracking-wide text-stone-300">
                        {sub.label}
                      </h3>
                      <span className="text-[11px] font-semibold text-stone-500">· {items.length}</span>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {items.map((ex: Exercise, i: number) => (
                        <GlassCard
                          key={`${sub.id}-${ex.slug}`}
                          as="button"
                          tint={i % 2 === 0 ? "emerald" : "neutral"}
                          onClick={() => launch(ex.slug)}
                          className={`flex flex-col text-left ${launching === ex.slug ? "opacity-60" : ""}`}
                        >
                          <div className="relative flex h-24 items-center justify-center bg-black/25 text-4xl">
                            <span className="absolute left-2 top-2 rounded-md border border-white/15 bg-white/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-200 backdrop-blur-xl">
                              Video
                            </span>
                            {ex.icon}
                            <div className="absolute bottom-2 right-2 grid h-7 w-7 place-items-center rounded-full bg-emerald-300/90">
                              <PlayCircle className="h-4 w-4 text-emerald-950" />
                            </div>
                          </div>
                          <div className="flex flex-1 flex-col justify-between p-4">
                            <div>
                              <p className="text-[10px] font-bold uppercase tracking-wide text-stone-400">
                                {ex.focus}
                              </p>
                              <h4 className="mt-1 font-display text-base font-bold leading-tight text-stone-50">
                                {ex.name}
                              </h4>
                            </div>
                            <span className="mt-3 border-t border-white/10 pt-2.5 text-[12px] font-bold text-emerald-300">
                              Watch short video
                            </span>
                          </div>
                        </GlassCard>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </main>

      <div className="sticky bottom-0 z-10">
        <BottomNav<NavId>
          items={[
            { id: "home", icon: Home, label: t("home") },
            { id: "library", icon: Dumbbell, label: "Tracking" },
            { id: "videos", icon: Video, label: "Videos" },
            { id: "profile", icon: User, label: "You" },
          ]}
          active="videos"
          onChange={handleNav}
        />
      </div>

      <ChildProfileSheet open={profileOpen} onOpenChange={setProfileOpen} patient={patient as never} />
    </div>
  );
}
