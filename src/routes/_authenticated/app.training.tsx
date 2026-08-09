import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { PlayCircle } from "lucide-react";

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
        items: EXERCISES.filter((e) => e.track === "arm"),
      },
      {
        id: "lower",
        label: "Lower body",
        icon: "🦵",
        items: EXERCISES.filter((e) => e.track === "leg" || e.track === "balance"),
      },
    ],
    []
  );

  return (
    <div className="min-h-screen bg-background text-foreground pb-12">
      <header className="border-b border-border bg-card/60 backdrop-blur sticky top-0 z-40">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">{t("training")}</p>
            <p className="font-display text-lg font-bold">{t("trainingTitle")}</p>
          </div>
          <LanguageSettings />
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">
        <div className="grid gap-6 md:grid-cols-2">
          {categories.map((c) => (
            <section key={c.id} className="rounded-2xl border-3 border-slate-950 bg-card p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="text-3xl">{c.icon}</div>
                <h3 className="font-display text-xl font-bold">{c.label}</h3>
              </div>

              <div className="mt-2 space-y-2">
                {c.items.map((ex: Exercise) => (
                  <div key={ex.slug} className="flex items-center justify-between rounded-lg border border-border p-3 bg-white">
                    <div className="flex items-center gap-3">
                      <div className="text-2xl">{ex.icon}</div>
                      <div>
                        <div className="font-semibold">{ex.name}</div>
                        <div className="text-xs text-muted-foreground">{ex.focus}</div>
                      </div>
                    </div>
                    <div>
                      <Button onClick={() => launch(ex.slug)} disabled={launching === ex.slug}>
                        <PlayCircle className="mr-2 h-4 w-4" /> {t("start")}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}
