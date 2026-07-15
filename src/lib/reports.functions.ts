import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateText } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

const InputSchema = z.object({
  patient_id: z.string().uuid(),
  period_days: z.number().int().min(1).max(365).default(30),
});

export const generatePatientReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Load patient (RLS ensures access)
    const { data: patient, error: pErr } = await supabase
      .from("patients")
      .select("*")
      .eq("id", data.patient_id)
      .maybeSingle();
    if (pErr) throw new Error(pErr.message);
    if (!patient) throw new Error("Patient not found");

    const since = new Date(Date.now() - data.period_days * 86_400_000).toISOString();

    const [{ data: sessions }, { data: painLogs }] = await Promise.all([
      supabase
        .from("sessions")
        .select("*")
        .eq("patient_id", data.patient_id)
        .gte("started_at", since)
        .order("started_at", { ascending: true }),
      supabase
        .from("pain_mood_logs")
        .select("*")
        .eq("patient_id", data.patient_id)
        .gte("created_at", since)
        .order("created_at", { ascending: true }),
    ]);

    const sessionSummary = (sessions ?? []).map((s) => ({
      date: s.started_at.slice(0, 10),
      exercise: s.exercise,
      reps: `${s.reps_completed}/${s.reps_target}`,
      completion_pct: s.completion_pct,
      correctness: s.avg_correctness,
      rom_deg: s.avg_range_of_motion_deg,
      difficulty: s.difficulty_level,
      duration_s: s.duration_seconds,
    }));

    const painSummary = (painLogs ?? []).map((p: any) => ({
      date: (p.created_at as string).slice(0, 10),
      pain: p.pain_level,
      mood: p.mood_level,
      note: p.note,
    }));

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY is not configured");
    const gateway = createLovableAiGatewayProvider(apiKey);

    const system = `You are a pediatric physiotherapy assistant helping a clinician
review a child's home therapy adherence and progress. Be concise, evidence-based,
and family-friendly. Never diagnose. Flag red flags (increasing pain, regression,
missed sessions) plainly.`;

    const prompt = `Patient: ${patient.child_name}
GMFCS level: ${patient.gmfcs_level ?? "unknown"}
Affected side: ${patient.affected_side}
Condition notes: ${patient.condition_notes ?? "none"}
Window: last ${data.period_days} days

Sessions (${sessionSummary.length}):
${JSON.stringify(sessionSummary, null, 2)}

Pain/mood logs (${painSummary.length}):
${JSON.stringify(painSummary, null, 2)}

Write a progress report with these sections, in Markdown:
1. **Summary** (2-3 sentences).
2. **Adherence** — sessions/week, missed days.
3. **Movement quality** — trends in correctness, ROM, difficulty progression.
4. **Pain & mood** — trend + red flags.
5. **Recommendations** — 3-5 concrete next steps (exercises to focus on,
   difficulty adjustments, in-clinic follow-up if needed).
6. **Follow-up window** — suggest weeks until next in-clinic visit.

End with a JSON block on its own line, prefixed by "META:" containing
{"summary": "<one-sentence>", "followup_weeks": <int>}.`;

    const { text } = await generateText({
      model: gateway("google/gemini-3-flash-preview"),
      system,
      prompt,
    });

    // Parse META
    let oneLine = "AI progress report generated.";
    let followupWeeks: number | null = null;
    const metaMatch = text.match(/META:\s*(\{[\s\S]*\})\s*$/);
    if (metaMatch) {
      try {
        const meta = JSON.parse(metaMatch[1]);
        if (typeof meta.summary === "string") oneLine = meta.summary;
        if (typeof meta.followup_weeks === "number")
          followupWeeks = Math.round(meta.followup_weeks);
      } catch {}
    }
    const body = text.replace(/META:\s*\{[\s\S]*\}\s*$/, "").trim();

    const { data: inserted, error: insErr } = await supabase
      .from("ai_reports")
      .insert({
        patient_id: data.patient_id,
        report_type: "on_demand",
        language: patient.preferred_language,
        summary: oneLine,
        content: { markdown: body, sessions: sessionSummary.length } as any,
        recommended_followup_weeks: followupWeeks,
        period_start: since,
        period_end: new Date().toISOString(),
      })
      .select()
      .single();

    if (insErr) throw new Error(insErr.message);
    // Suppress unused warning for userId (RLS uses it via supabase client)
    void userId;
    return inserted;
  });
