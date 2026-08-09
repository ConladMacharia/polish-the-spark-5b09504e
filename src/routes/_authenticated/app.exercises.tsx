import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ArrowLeft, PlayCircle, Search, Sparkles, Loader2, Video, X } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EXERCISES, type Exercise, type ExerciseCategory } from "@/lib/exercise-catalog";
import { LanguageSettings } from "@/components/LanguageSettings";
import { useLanguage } from "@/lib/i18n/LanguageProvider";

export const Route = createFileRoute("/_authenticated/app/exercises")({
  head: () => ({
    meta: [
      { title: "Exercise library — Neuro-Bridge" },
      {
        name: "description",
        content:
          "Full 50-exercise catalog of physiotherapy and occupational therapy for cerebral palsy.",
      },
    ],
  }),
  component: ExercisesPage,
});

function ExercisesPage() {
  const navigate = useNavigate();
  const { t, lang } = useLanguage();
  const [filter, setFilter] = useState<"all" | ExerciseCategory>("all");
  const [q, setQ] = useState("");
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const [launching, setLaunching] = useState<string | null>(null);

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

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return EXERCISES.filter((e) => {
      if (filter !== "all" && e.category !== filter) return false;
      if (!term) return true;
      return (
        e.name.toLowerCase().includes(term) ||
        e.focus.toLowerCase().includes(term) ||
        e.description.toLowerCase().includes(term) ||
        e.benefits.toLowerCase().includes(term)
      );
    });
  }, [filter, q]);

  const physioCount = useMemo(() => EXERCISES.filter((e) => e.category === "pt").length, []);
  const otCount = useMemo(() => EXERCISES.filter((e) => e.category === "ot").length, []);

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
      autocam: "1",
      lang,
    });
    window.location.href = `/neuro-bridge/index.html#${params.toString()}`;
  }

  return (
    <div className="min-h-screen bg-background text-foreground pb-12">
      <header className="border-b border-border bg-card/60 backdrop-blur sticky top-0 z-40">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="sm">
              <Link to="/app/caregiver">
                <ArrowLeft className="mr-2 h-4 w-4" /> {t("home")}
              </Link>
            </Button>
            <div>
              <p className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground font-semibold">
                <Sparkles className="h-3.5 w-3.5 text-primary" /> {t("libraryEyebrow")}
              </p>
              <p className="font-display text-lg leading-none font-bold">{t("libraryTitle")}</p>
            </div>
            <LanguageSettings />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">
        <div className="mb-6">
          <h1 className="font-display text-3xl font-bold">{t("libraryTitle")}</h1>
          <p className="mt-1 text-sm text-muted-foreground font-medium">
            {t("librarySubtitle", { pt: physioCount, ot: otCount })}
          </p>
        </div>

        {/* Filter and Search Bar */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="inline-flex rounded-full border-2 border-slate-900 bg-amber-50 p-1 text-xs font-bold shadow-[2px_2px_0px_#0f172a]">
            {(["all", "pt", "ot"] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setFilter(k)}
                className={`rounded-full px-4 py-1.5 transition ${
                  filter === k
                    ? "bg-blue-600 text-white shadow"
                    : "text-slate-700 hover:text-slate-900"
                }`}
              >
                {k === "all"
                  ? t("filterAll", { count: EXERCISES.length })
                  : k === "pt"
                    ? t("filterPhysio", { count: physioCount })
                    : t("filterOccupational", { count: otCount })}
              </button>
            ))}
          </div>
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("searchExercises")}
              className="pl-9 border-2 border-slate-900 shadow-[2px_2px_0px_#0f172a] rounded-xl font-medium"
            />
          </div>
        </div>

        <div className="mb-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          {filter === "all"
            ? t("allExercises", { count: filtered.length })
            : filter === "pt"
              ? t("filterPhysio", { count: filtered.length })
              : t("filterOccupational", { count: filtered.length })}
        </div>

        {/* 2-Column Exercise Cards Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((e) => (
            <article
              key={e.slug}
              onClick={() => setSelectedExercise(e)}
              className="flex flex-col rounded-2xl border-3 border-slate-950 bg-card shadow-[4px_4px_0px_#0f172a] cursor-pointer transition-transform hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5 overflow-hidden"
            >
              <div className="relative h-24 bg-gradient-to-br from-indigo-100 to-blue-200 flex items-center justify-center text-4xl">
                <span className="absolute top-2 left-2 text-[10px] font-extrabold bg-lime-400 border border-slate-950 px-1.5 py-0.5 rounded-md text-slate-950">
                  {t("aiTracked")}
                </span>
                {e.icon}
                <div className="absolute bottom-2 right-2 h-7 w-7 rounded-full bg-slate-900/80 text-white grid place-items-center text-xs">
                  <PlayCircle className="h-4 w-4 fill-white text-slate-900" />
                </div>
              </div>
              <div className="p-4 flex-1 flex flex-col justify-between">
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                    {e.category === "pt" ? t("physiotherapy") : t("occupational")} · {e.focus}
                  </p>
                  <h3 className="mt-1 font-display text-lg font-bold leading-tight">{e.name}</h3>
                  <p className="mt-1.5 text-xs text-muted-foreground font-semibold line-clamp-2">
                    {e.benefits}
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-xs font-bold text-blue-600">
                  <span>{t("tapForDetails")}</span>
                  <span className="text-slate-900">▶</span>
                </div>
              </div>
            </article>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="rounded-2xl border-2 border-dashed border-border p-12 text-center text-sm text-muted-foreground font-medium">
            {t("noExercisesMatch")}
          </div>
        )}

        {/* Video Bottom-Sheet Modal */}
        {selectedExercise && (
          <div
            className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
            onClick={() => setSelectedExercise(null)}
          >
            <div
              className="w-full max-w-lg rounded-t-3xl sm:rounded-3xl border-3 border-slate-950 bg-card p-6 shadow-2xl animate-in slide-in-from-bottom duration-200"
              onClick={(evt) => evt.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-extrabold uppercase text-muted-foreground">
                  {selectedExercise.category === "pt" ? t("physiotherapy") : t("occupational")} ·{" "}
                  {selectedExercise.focus}
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedExercise(null)}
                  className="rounded-full p-1 hover:bg-accent text-slate-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Video Stage Placeholder */}
              <div className="rounded-2xl bg-slate-950 text-white h-48 flex flex-col items-center justify-center p-6 text-center mb-4">
                <Video className="h-10 w-10 text-slate-400 mb-2 opacity-80" />
                <p className="font-display text-lg font-bold text-white">{t("footageMissing")}</p>
                <p className="mt-1 text-xs text-slate-400 font-medium max-w-xs">
                  {t("footageMissingSub")}
                </p>
              </div>

              <h2 className="font-display text-2xl font-bold">{selectedExercise.name}</h2>
              <p className="mt-1 text-sm font-semibold text-slate-700">
                {selectedExercise.description}
              </p>
              <p className="mt-2 text-xs text-slate-500 font-medium leading-relaxed">
                <strong className="text-slate-900">{t("clinicalBenefit")} </strong>
                {selectedExercise.benefits}
              </p>

              <div className="mt-6 flex gap-3">
                <Button
                  className="flex-1 rounded-xl font-display font-bold border-2 border-slate-950 shadow-[2px_2px_0px_#0f172a]"
                  disabled={!patient || launching === selectedExercise.slug}
                  onClick={() => launch(selectedExercise.slug)}
                >
                  {launching === selectedExercise.slug ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <PlayCircle className="mr-2 h-4 w-4" />
                  )}
                  {t("startTherapyGame")}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setSelectedExercise(null)}
                  className="rounded-xl font-display font-bold border-2 border-slate-950"
                >
                  {t("close")}
                </Button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
