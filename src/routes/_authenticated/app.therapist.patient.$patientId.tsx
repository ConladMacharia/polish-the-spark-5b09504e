import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  ArrowLeft,
  Sparkles,
  Activity,
  HeartPulse,
  Calendar,
  Loader2,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { generatePatientReport } from "@/lib/reports.functions";

export const Route = createFileRoute("/_authenticated/app/therapist/patient/$patientId")({
  head: () => ({ meta: [{ title: "Patient — Neuro-Bridge" }] }),
  component: PatientDetail,
});

function PatientDetail() {
  const { patientId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const runReport = useServerFn(generatePatientReport);

  const { data: patient, isLoading: pLoading } = useQuery({
    queryKey: ["patient", patientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("patients")
        .select("*")
        .eq("id", patientId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: sessions } = useQuery({
    queryKey: ["patient-sessions", patientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sessions")
        .select("*")
        .eq("patient_id", patientId)
        .order("started_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
  });

  const { data: reports } = useQuery({
    queryKey: ["patient-reports", patientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_reports")
        .select("*")
        .eq("patient_id", patientId)
        .order("generated_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const mutation = useMutation({
    mutationFn: async () => runReport({ data: { patient_id: patientId, period_days: 30 } }),
    onSuccess: () => {
      toast.success("AI progress report generated");
      qc.invalidateQueries({ queryKey: ["patient-reports", patientId] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to generate report"),
  });

  if (pLoading) {
    return <div className="p-10 text-sm text-muted-foreground">Loading…</div>;
  }
  if (!patient) {
    return (
      <div className="p-10">
        <p className="text-sm text-muted-foreground">Patient not found.</p>
        <Button className="mt-4" onClick={() => navigate({ to: "/app/therapist" })}>
          Back
        </Button>
      </div>
    );
  }

  const totalSessions = sessions?.length ?? 0;
  const avgCompletion =
    sessions && sessions.length
      ? Math.round(
          sessions.reduce((a, s) => a + (s.completion_pct ?? 0), 0) / sessions.length,
        )
      : 0;
  const avgCorrect =
    sessions && sessions.length
      ? Math.round(
          (sessions.reduce((a, s) => a + (s.avg_correctness ?? 0), 0) /
            sessions.length) *
            100,
        ) / 100
      : null;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/60 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link
            to="/app/therapist"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> All patients
          </Link>
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="rounded-full"
          >
            {mutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            Generate AI report
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8 space-y-8">
        <section>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Patient</p>
          <h1 className="font-display text-4xl">{patient.child_name}</h1>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-accent px-3 py-1 font-semibold text-accent-foreground">
              {patient.gmfcs_level ? `GMFCS ${patient.gmfcs_level}` : "GMFCS —"}
            </span>
            <span className="rounded-full bg-secondary px-3 py-1 capitalize">
              {patient.affected_side} side
            </span>
            <span className="rounded-full bg-secondary px-3 py-1 uppercase">
              {patient.preferred_language}
            </span>
            {!patient.claimed_by_caregiver_id && (
              <span className="rounded-full bg-yellow-100 px-3 py-1 text-yellow-900">
                Awaiting caregiver — code {patient.claim_code}
              </span>
            )}
          </div>
          {patient.condition_notes && (
            <p className="mt-4 max-w-2xl text-sm text-muted-foreground">
              {patient.condition_notes}
            </p>
          )}
        </section>

        <section className="grid gap-4 sm:grid-cols-3">
          <StatCard icon={<Calendar className="h-5 w-5" />} label="Sessions (30d)" value={totalSessions} />
          <StatCard icon={<Activity className="h-5 w-5" />} label="Avg completion" value={`${avgCompletion}%`} />
          <StatCard
            icon={<HeartPulse className="h-5 w-5" />}
            label="Avg form score"
            value={avgCorrect != null ? avgCorrect.toFixed(2) : "—"}
          />
        </section>

        <section>
          <h2 className="mb-3 font-display text-2xl">AI progress reports</h2>
          {!reports || reports.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card p-6 text-sm text-muted-foreground">
              No reports yet. Click <strong>Generate AI report</strong> to analyze the
              last 30 days of sessions and pain logs.
            </div>
          ) : (
            <div className="space-y-4">
              {reports.map((r) => (
                <article key={r.id} className="rounded-2xl border border-border bg-card p-5">
                  <div className="flex items-center justify-between">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      {r.report_type} · {new Date(r.generated_at).toLocaleString()}
                    </p>
                    {r.recommended_followup_weeks != null && (
                      <span className="rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground">
                        Follow-up in {r.recommended_followup_weeks}w
                      </span>
                    )}
                  </div>
                  <p className="mt-2 font-display text-lg">{r.summary}</p>
                  {(r.content as any)?.markdown && (
                    <pre className="mt-3 whitespace-pre-wrap font-sans text-sm text-foreground/90">
                      {(r.content as any).markdown}
                    </pre>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-3 font-display text-2xl">Recent sessions</h2>
          {!sessions || sessions.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card p-6 text-sm text-muted-foreground">
              No sessions logged yet. Once the caregiver runs a therapy session, it
              will appear here.
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-border">
              <table className="w-full text-sm">
                <thead className="bg-secondary text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2">Date</th>
                    <th className="px-4 py-2">Exercise</th>
                    <th className="px-4 py-2">Reps</th>
                    <th className="px-4 py-2">Completion</th>
                    <th className="px-4 py-2">Form</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border bg-card">
                  {sessions.map((s) => (
                    <tr key={s.id}>
                      <td className="px-4 py-2">
                        {new Date(s.started_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-2">{s.exercise}</td>
                      <td className="px-4 py-2">
                        {s.reps_completed}/{s.reps_target}
                      </td>
                      <td className="px-4 py-2">{s.completion_pct}%</td>
                      <td className="px-4 py-2">
                        {s.avg_correctness != null ? s.avg_correctness.toFixed(2) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-xs uppercase tracking-wide">{label}</span>
      </div>
      <p className="mt-2 font-display text-3xl">{value}</p>
    </div>
  );
}
