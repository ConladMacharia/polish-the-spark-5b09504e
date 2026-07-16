import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ArrowLeft, PlayCircle, Search, Sparkles, Loader2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EXERCISES, type ExerciseCategory } from "@/lib/exercise-catalog";

export const Route = createFileRoute("/_authenticated/app/exercises")({
  head: () => ({
    meta: [
      { title: "Exercise library — Neuro-Bridge" },
      { name: "description", content: "Full list of physiotherapy and occupational therapy exercises for children with cerebral palsy." },
    ],
  }),
  component: ExercisesPage,
});

function ExercisesPage() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<"all" | ExerciseCategory>("all");
  const [q, setQ] = useState("");
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
        e.description.toLowerCase().includes(term)
      );
    });
  }, [filter, q]);

  const grouped = useMemo(() => {
    return {
      pt: filtered.filter((e) => e.category === "pt"),
      ot: filtered.filter((e) => e.category === "ot"),
    };
  }, [filtered]);

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
    });
    window.location.href = `/neuro-bridge/index.html#${params.toString()}`;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/60 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="sm">
              <Link to="/app/caregiver">
                <ArrowLeft className="mr-2 h-4 w-4" /> Home
              </Link>
            </Button>
            <div>
              <p className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
                <Sparkles className="h-4 w-4" /> Library
              </p>
              <p className="font-display text-lg leading-none">Exercises</p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">
        <div className="mb-6">
          <h1 className="font-display text-3xl">Exercise library</h1>
          <p className="text-sm text-muted-foreground">
            Physiotherapy and occupational therapy exercises used with children with cerebral palsy. Guided ones
            open the AI-tracked player; the rest are structured routines to practice at home.
          </p>
        </div>

        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="inline-flex rounded-full border border-border bg-card p-1 text-sm">
            {(["all", "pt", "ot"] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setFilter(k)}
                className={`rounded-full px-4 py-1.5 transition ${
                  filter === k ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {k === "all" ? "All" : k === "pt" ? "Physiotherapy" : "Occupational"}
              </button>
            ))}
          </div>
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search exercises…"
              className="pl-9"
            />
          </div>
        </div>

        {(["pt", "ot"] as const).map((cat) => {
          const list = grouped[cat];
          if (list.length === 0) return null;
          return (
            <section key={cat} className="mb-10">
              <h2 className="mb-3 font-display text-xl">
                {cat === "pt" ? "Physiotherapy" : "Occupational therapy"}
                <span className="ml-2 text-sm text-muted-foreground">({list.length})</span>
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {list.map((e) => (
                  <article
                    key={e.slug}
                    className="flex flex-col rounded-2xl border border-border bg-card p-4 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-3xl leading-none">{e.icon}</div>
                      {e.gamified ? (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                          AI tracked
                        </span>
                      ) : (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                          Guided
                        </span>
                      )}
                    </div>
                    <h3 className="mt-3 font-display text-lg leading-tight">{e.name}</h3>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">{e.focus}</p>
                    <p className="mt-2 text-sm text-foreground/80">{e.description}</p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground/70">Benefit: </span>
                      {e.benefits}
                    </p>
                    <div className="mt-4">
                      {e.gamified ? (
                        <Button
                          size="sm"
                          className="w-full"
                          disabled={!patient || launching === e.slug}
                          onClick={() => launch(e.slug)}
                        >
                          {launching === e.slug ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <PlayCircle className="mr-2 h-4 w-4" />
                          )}
                          Start
                        </Button>
                      ) : (
                        <Button size="sm" variant="secondary" className="w-full" disabled>
                          Home routine
                        </Button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          );
        })}

        {filtered.length === 0 && (
          <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No exercises match your search.
          </p>
        )}

        <div className="mt-8">
          <Button variant="outline" onClick={() => navigate({ to: "/app/caregiver" })}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to home
          </Button>
        </div>
      </main>
    </div>
  );
}
