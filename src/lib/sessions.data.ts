import { supabase } from "@/integrations/supabase/client";
import { resolveTargetSlug } from "@/lib/exercise-targets";

export type AngleSample = { t: number; angle: number };

/** Maps a catalog slug to the sessions.exercise enum value. */
export function exerciseEnumFor(slug?: string) {
  if (!slug) return "arm_raise" as const;
  if (slug === "gait") return "gait" as const;
  if (["balance", "head", "stretch", "ball-throw", "single-leg"].includes(slug))
    return "balance_hold" as const;
  if (
    ["prone", "rolling", "kneeling", "half-kneel", "wall-stand", "horse", "breathing"].includes(slug)
  )
    return "postural_control" as const;
  if (
    [
      "leg",
      "leg-kick",
      "march",
      "squat",
      "sitstand",
      "bridge",
      "ankle",
      "crawl",
      "heel-raise",
      "step-up",
      "obstacle",
      "aquatic",
    ].includes(slug)
  )
    return "leg_kick" as const;
  return "arm_raise" as const;
}

/** Returns the patient id for the signed-in caregiver's first claimed child. */
export async function getMyPatientId(): Promise<string | null> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) return null;
  const { data } = await supabase
    .from("patients")
    .select("id")
    .eq("claimed_by_caregiver_id", uid)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}

interface SaveArgs {
  history: AngleSample[];
  exerciseSlug?: string;
  side?: "left" | "right" | null;
  /** Optional explicit patient; resolved from the caregiver's child when omitted. */
  patientId?: string | null;
}

/**
 * Persists one tracked attempt so the progress graph can plot it.
 * Silently no-ops when there is no child or no recorded samples.
 */
export async function saveTrackedSession({
  history,
  exerciseSlug,
  side,
  patientId,
}: SaveArgs): Promise<void> {
  const angles = history.map((h) => h.angle).filter((a) => Number.isFinite(a));
  if (angles.length === 0) return;

  try {
    const pid = patientId ?? (await getMyPatientId());
    if (!pid) return;

    const { data: userData } = await supabase.auth.getUser();
    const caregiverId = userData.user?.id ?? null;

    const first = history[0].t;
    const last = history[history.length - 1].t;
    const durationSeconds = Math.max(1, Math.round((last - first) / 1000));
    const avg = Math.round(angles.reduce((s, v) => s + v, 0) / angles.length);
    const best = Math.round(Math.max(...angles));

    const { error } = await supabase.from("sessions").insert({
      patient_id: pid,
      caregiver_id: caregiverId,
      exercise: exerciseEnumFor(exerciseSlug),
      exercise_slug: resolveTargetSlug(exerciseSlug ?? "forward-reach"),
      side: side ?? null,
      started_at: new Date(first).toISOString(),
      duration_seconds: durationSeconds,
      reps_completed: 0,
      reps_target: 0,
      completion_pct: 0,
      difficulty_level: 1,
      avg_range_of_motion_deg: avg,
      best_angle_deg: best,
    });
    if (error) throw error;
  } catch (e) {
    console.error("Failed to save tracked session:", e);
  }
}
