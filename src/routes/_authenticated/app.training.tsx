import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { PlayCircle, ArrowLeft } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { EXERCISES, type Exercise } from "@/lib/exercise-catalog";
import { LanguageSettings } from "@/components/LanguageSettings";
import { useLanguage } from "@/lib/i18n/LanguageProvider";

export const Route = createFileRoute("/_authenticated/app/training")({
  head: () => ({
    meta: [{ title: "Training — Neuro-Bridge" }],
  }),
  component: TrainingPage,
});

function TrainingPage() {
  const { t, lang } = useLanguage();
  const navigate = useNavigate();
  const [launching, setLaunching] = useState<string | null>(null);
  const [stage, setStage] = useState<"categories" | "subcats" | "exercises">("categories");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [activeSubcat, setActiveSubcat] = useState<string | null>(null);

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
      exercise: slug,
      lang,
    });
    window.location.href = `/neuro-bridge/index.html#${params.toString()}`;
  }

  const categories = useMemo(
    () => [
      {
        id: "upper",
        label: "Upper body",
        icon: "💪",
        track: "arm",
        subcats: [
          { id: "shoulder", label: "Shoulder", keywords: ["shoulder", "posture"] },
          { id: "elbow", label: "Elbow", keywords: ["elbow"] },
          { id: "wrist", label: "Wrist", keywords: ["wrist"] },
          { id: "hand", label: "Hand & Fingers", keywords: ["hand", "finger", "grasp", "pincer", "thumb"] },
        ],
      },
      {
        id: "lower",
        label: "Lower body",
        icon: "🦵",
        track: "leg",
        subcats: [
          { id: "hip", label: "Hip", keywords: ["hip"] },
          { id: "knee", label: "Knee", keywords: ["knee"] },
          { id: "ankle", label: "Ankle", keywords: ["ankle", "foot"] },
          { id: "balance", label: "Balance", keywords: ["balance"] },
        ],
      },
    ],
    []
  );

  function findCategory(id: string) {
    return categories.find((c) => c.id === id) ?? null;
  }

  function exercisesForSubcat(catId: string, subId: string) {
    const cat = findCategory(catId);
    if (!cat) return [] as Exercise[];
    const sub = cat.subcats.find((s: any) => s.id === subId);
    const track = cat.track;
    const base = EXERCISES.filter((e) => (track === "leg" ? (e.track === "leg" || e.track === "balance") : e.track === track));
    if (!sub) return base;
    const keywords: string[] = sub.keywords;
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
              <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">{t("exerciseLibrary")}</p>
              <p className="font-display text-lg font-bold text-slate-900">{t("yourToolkit")}</p>
            </div>
          </div>
          <LanguageSettings />
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">
        {stage === "categories" && (
          <div className="grid gap-6 md:grid-cols-2">
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  setActiveCategory(c.id);
                  setStage("subcats");
                }}
                className="rounded-2xl border-3 border-slate-900 bg-gradient-to-br from-white to-slate-50 p-6 text-left shadow hover:shadow-lg transform hover:-translate-y-1 transition"
              >
                <div className="flex items-center gap-4">
                  <div className="text-4xl">{c.icon}</div>
                  <div>
                    <h3 className="font-display text-xl font-bold text-slate-900">{c.label}</h3>
                    <p className="text-sm text-slate-600 mt-1">Tap to explore</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {stage === "subcats" && activeCategory && (
          <div>
            <div className="mb-4 flex items-center gap-3">
              <button
                onClick={() => {
                  setStage("categories");
                  setActiveCategory(null);
                }}
                className="rounded-full bg-white p-2 shadow-sm hover:bg-white/90"
                aria-label="Back to categories"
              >
                <ArrowLeft className="h-4 w-4 text-slate-900" />
              </button>
              <h2 className="font-display text-2xl font-bold text-slate-900">{findCategory(activeCategory)!.label}</h2>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
              {findCategory(activeCategory)!.subcats.map((s: any) => (
                <button
                  key={s.id}
                  onClick={() => {
                    setActiveSubcat(s.id);
                    setStage("exercises");
                  }}
                  className="rounded-2xl border-2 border-slate-900 bg-white p-4 text-left shadow hover:shadow-lg hover:bg-slate-50 transition"
                >
                  <div className="font-bold text-slate-900">{s.label}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {stage === "exercises" && activeCategory && activeSubcat && (
          <div>
            <div className="mb-4 flex items-center gap-3">
              <button
                onClick={() => setStage("subcats")}
                className="rounded-full bg-white p-2 shadow-sm hover:bg-white/90"
                aria-label="Back to subcategories"
              >
                <ArrowLeft className="h-4 w-4 text-slate-900" />
              </button>
              <h2 className="font-display text-2xl font-bold text-slate-900">
                {findCategory(activeCategory)!.label} — {findCategory(activeCategory)!.subcats.find((s: any) => s.id === activeSubcat)!.label}
              </h2>
            </div>

            <div className="space-y-3">
              {exercisesForSubcat(activeCategory, activeSubcat).map((ex) => (
                <div key={ex.slug} className="flex items-center justify-between rounded-lg border border-border p-3 bg-white shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="text-2xl">{ex.icon}</div>
                    <div>
                      <div className="font-semibold text-slate-900">{ex.name}</div>
                      <div className="text-xs text-slate-600">{ex.focus}</div>
                    </div>
                  </div>
                  <div>
                    <Button onClick={() => launch(ex.slug)} disabled={launching === ex.slug} className="bg-blue-600 text-white">
                      <PlayCircle className="mr-2 h-4 w-4" /> Watch short video
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
