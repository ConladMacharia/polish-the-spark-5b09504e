import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PlayCircle, ArrowLeft } from "lucide-react";

import { EXERCISES, type Exercise } from "@/lib/exercise-catalog";
import { LanguageSettings } from "@/components/LanguageSettings";
import { SidedExerciseSession } from "@/components/SidedExerciseSession";

import { useLanguage } from "@/lib/i18n/LanguageProvider";


export const Route = createFileRoute("/_authenticated/app/exercises")({
  head: () => ({
    meta: [
      { title: "Live session — Neuro-Bridge" },
      {
        name: "description",
        content:
          "Start an AI tracked cerebral palsy therapy session, grouped by upper and lower body.",
      },
      { property: "og:title", content: "Live session — Neuro-Bridge" },
      {
        property: "og:description",
        content: "AI tracked therapy exercises grouped by body region.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LiveSessionPage,
});

function LiveSessionPage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);

  // Which joint angle to report for the selected exercise
  const ELBOW_SLUGS = new Set(["reach", "shoulder", "draw", "tracing", "page-turn"]);
  const trackedMovement: "elbow" | "shoulderFlexion" =
    selectedExercise && ELBOW_SLUGS.has(selectedExercise.slug) ? "elbow" : "shoulderFlexion";

  function closeCamera() {
    setSelectedExercise(null);
  }

  const categories = useMemo(
    () => [
      {
        id: "upper",
        label: "Upper body",
        icon: "💪",
        track: "arm",
        subcats: [
          {
            id: "shoulder",
            label: "Shoulder",
            icon: "🦾",
            items: [
              { slug: "arm", name: "Forward reach", focus: "Flexion" },
              { slug: "arm-circles", name: "Arm lowering", focus: "Extension" },
              { slug: "side-bend", name: "Side reach", focus: "Abduction" },
              { slug: "midline", name: "Cross body reach", focus: "Adduction" },
              { slug: "wall-slide", name: "Rotation", focus: "Internal and external rotation" },
            ],
          },
          {
            id: "elbow",
            label: "Elbow",
            icon: "💪",
            items: [
              { slug: "reach", name: "Bend and straighten", focus: "Flexion and extension" },
              { slug: "shoulder", name: "Palm up, palm down", focus: "Supination and pronation" },
            ],
          },
          {
            id: "wrist",
            label: "Wrist",
            icon: "🖐️",
            items: [
              { slug: "draw", name: "Wrist bend up", focus: "Extension" },
              { slug: "tracing", name: "Wrist bend down", focus: "Flexion" },
              {
                slug: "page-turn",
                name: "Side to side wrist tilt",
                focus: "Radial and ulnar deviation",
              },
            ],
          },
          {
            id: "hand",
            label: "Hand & Fingers",
            icon: "🤲",
            keywords: ["hand", "finger", "grasp", "pincer", "thumb"],
          },
        ],
      },
      {
        id: "lower",
        label: "Lower body",
        icon: "🦵",
        track: "leg",
        subcats: [
          { id: "hip", label: "Hip", icon: "🦿", keywords: ["hip"] },
          { id: "knee", label: "Knee", icon: "🦵", keywords: ["knee"] },
          { id: "ankle", label: "Ankle", icon: "👟", keywords: ["ankle", "foot"] },
          { id: "balance", label: "Balance", icon: "⚖️", keywords: ["balance"] },
        ],
      },
    ],
    [],
  );

  function findCategory(id: string) {
    return categories.find((c) => c.id === id) ?? null;
  }

  function exercisesForSubcat(catId: string, subId: string) {
    const cat = findCategory(catId);
    if (!cat) return [] as Exercise[];
    const sub: any = cat.subcats.find((s: any) => s.id === subId);
    const track = cat.track;
    const base = EXERCISES.filter((e) =>
      track === "leg" ? e.track === "leg" || e.track === "balance" : e.track === track,
    );
    if (!sub) return base;
    if (sub.items) {
      return sub.items.map((it: any) => {
        const found = EXERCISES.find((e) => e.slug === it.slug);
        return {
          ...(found ?? ({} as Exercise)),
          slug: it.slug,
          name: it.name,
          focus: it.focus,
          icon: found?.icon ?? "",
        } as Exercise;
      });
    }
    const keywords: string[] = sub.keywords ?? [];
    const matches = base.filter((e) => {
      const hay = `${e.name} ${e.focus} ${e.description} ${e.slug}`.toLowerCase();
      return keywords.some((k) => hay.includes(k));
    });
    return matches.length ? matches : base;
  }

  return (
    <div className="min-h-screen bg-background text-foreground pb-12">
      <header className="border-b border-border bg-card/60 backdrop-blur sticky top-0 z-40">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate({ to: "/app/caregiver" })}
              aria-label="Back to dashboard"
              className="rounded-full bg-white/90 hover:bg-white p-2 shadow-sm"
            >
              <ArrowLeft className="h-4 w-4 text-slate-900" />
            </button>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">
                {t("exerciseLibrary")}
              </p>
              <p className="font-display text-lg font-bold text-slate-900">{t("yourToolkit")}</p>
            </div>
          </div>
          <LanguageSettings />
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8 space-y-10">
        {categories.map((cat) => (
          <section key={cat.id}>
            <div className="mb-4 flex items-center gap-3 border-b-3 border-dashed border-slate-900 pb-2">
              <span className="text-3xl">{cat.icon}</span>
              <h2 className="font-display text-2xl font-bold uppercase tracking-wide text-slate-900">
                {cat.label}
              </h2>
              <span className="ml-auto rounded-full bg-slate-900 px-3 py-1 text-xs font-extrabold text-white">
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
                      <span className="text-xl">{sub.icon}</span>
                      <h3 className="text-xs font-extrabold uppercase tracking-widest text-slate-600">
                        {sub.label}
                      </h3>
                      <span className="text-xs font-bold text-slate-400">· {items.length}</span>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {items.map((ex: Exercise) => (
                        <button
                          key={`${sub.id}-${ex.slug}`}
                          type="button"
                          onClick={() => setSelectedExercise(ex)}
                          className="flex flex-col overflow-hidden rounded-2xl border-3 border-slate-950 bg-card text-left shadow-[4px_4px_0px_#0f172a] transition-transform hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5"
                        >
                          <div className="relative flex h-24 items-center justify-center bg-gradient-to-br from-indigo-100 to-blue-200 text-4xl">
                            <span className="absolute left-2 top-2 rounded-md border border-slate-950 bg-lime-400 px-1.5 py-0.5 text-[10px] font-extrabold text-slate-950">
                              {t("aiTracked")}
                            </span>
                            {ex.icon}
                            <div className="absolute bottom-2 right-2 grid h-7 w-7 place-items-center rounded-full bg-slate-900/80">
                              <PlayCircle className="h-4 w-4 fill-white text-slate-900" />
                            </div>
                          </div>
                          <div className="flex flex-1 flex-col justify-between p-4">
                            <div>
                              <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                                {ex.focus}
                              </p>
                              <h4 className="mt-1 font-display text-lg font-bold leading-tight text-slate-900">
                                {ex.name}
                              </h4>
                            </div>
                            <span className="mt-4 border-t border-border pt-3 text-xs font-bold text-blue-600">
                              ai tracked exercise
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </main>

      {selectedExercise ? (
        <div className="fixed inset-0 z-50 bg-slate-950/95 text-white px-4 py-5 sm:px-6">
          <div className="mx-auto flex max-w-5xl flex-col gap-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">Live tracking</p>
                <h2 className="text-2xl font-bold">{selectedExercise.name}</h2>
                <p className="text-sm text-slate-300">{selectedExercise.focus}</p>
              </div>
              <button
                type="button"
                onClick={closeCamera}
                className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20"
              >
                Close
              </button>
            </div>

            <SidedExerciseSession
              movement={trackedMovement}
              exerciseName={selectedExercise.name}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
