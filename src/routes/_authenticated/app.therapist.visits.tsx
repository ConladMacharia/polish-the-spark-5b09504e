import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CalendarCheck, CalendarClock, Lock } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { LogVisitDialog } from "@/components/therapist/LogVisitDialog";
import { useMyTherapist } from "@/lib/therapist";

export const Route = createFileRoute("/_authenticated/app/therapist/visits")({
  head: () => ({ meta: [{ title: "Visits — Neuro-Bridge" }] }),
  component: Visits,
});

const fmt = (d: string) =>
  new Date(d + "T00:00:00").toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

function Visits() {
  const { data: me, isLoading: meLoading } = useMyTherapist();
  const verified = !!me?.verified;

  const { data, isLoading } = useQuery({
    queryKey: ["therapist-visits"],
    enabled: verified,
    queryFn: async () => {
      const { data: visits, error } = await supabase
        .from("visits")
        .select("*")
        .order("visit_date", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      const ids = [...new Set((visits ?? []).map((v) => v.child_id))];
      const { data: kids } = ids.length
        ? await supabase.from("patients").select("id, child_name").in("id", ids)
        : { data: [] };
      const names = new Map((kids ?? []).map((k) => [k.id, k.child_name]));
      return (visits ?? []).map((v) => ({ ...v, name: names.get(v.child_id) ?? "Child" }));
    },
  });

  const visits = data ?? [];
  const upcoming = visits
    .filter((v) => v.next_review && v.next_review >= new Date().toISOString().slice(0, 10))
    .sort((a, b) => (a.next_review! < b.next_review! ? -1 : 1))[0];

  return (
    <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
      <section className="nb-hero p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-white/75">Therapist</p>
        <h1 className="font-display text-3xl">Visits</h1>
        <p className="mt-1 max-w-md text-sm text-white/90">
          {!verified
            ? "Locked until your account is verified"
            : upcoming
              ? `Next review: ${upcoming.name} on ${fmt(upcoming.next_review!)}`
              : "A simple record of every home visit"}
        </p>
        {verified && (
          <div className="relative z-10 mt-5">
            <LogVisitDialog
              trigger={
                <button className="rounded-full bg-white px-5 py-2.5 text-sm font-bold text-[#5B3DF5] shadow-sm transition hover:bg-[#E8DEFF]">
                  + Log a visit
                </button>
              }
            />
          </div>
        )}
      </section>

      {!meLoading && !verified && (
        <div className="mt-6 rounded-3xl border border-dashed border-border bg-card p-10 text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-secondary text-primary">
            <Lock className="h-6 w-6" />
          </div>
          <h3 className="mt-4 font-display text-xl">Almost there</h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Once you are verified and have accepted a request, you can log visits here.
          </p>
        </div>
      )}

      {verified && isLoading && <p className="mt-6 text-sm text-muted-foreground">Loading…</p>}

      {verified && !isLoading && visits.length === 0 && (
        <div className="mt-6 rounded-3xl border border-dashed border-border bg-card p-10 text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-secondary text-primary">
            <CalendarCheck className="h-6 w-6" />
          </div>
          <h3 className="mt-4 font-display text-xl">No visits logged yet</h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            After you accept a request and visit the child, log the visit here.
          </p>
        </div>
      )}

      {visits.length > 0 && (
        <ol className="mt-6 space-y-4">
          {visits.map((v) => (
            <li key={v.id} className="rounded-3xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <p className="font-display text-lg">{v.name}</p>
                <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground">
                  {fmt(v.visit_date)}
                </span>
              </div>
              <p className="mt-2 whitespace-pre-line text-sm">{v.activities}</p>
              {v.milestone_notes && (
                <p className="mt-3 rounded-2xl bg-accent p-3 text-sm text-accent-foreground">
                  <span className="font-semibold">Progress: </span>
                  {v.milestone_notes}
                </p>
              )}
              {v.next_review && (
                <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                  <CalendarClock className="h-4 w-4 text-primary" /> Next review{" "}
                  {fmt(v.next_review)}
                </p>
              )}
            </li>
          ))}
        </ol>
      )}
    </main>
  );
}
