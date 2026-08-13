import { supabase } from "@/integrations/supabase/client";
import {
  resolveTargetSlug,
  type ChildExerciseTargetOverride,
} from "@/lib/exercise-targets";

/** Loads all therapist-set target overrides for one child (patient). */
export async function fetchChildExerciseTargets(
  childId: string,
): Promise<ChildExerciseTargetOverride[]> {
  if (!childId) return [];
  const { data, error } = await supabase
    .from("child_exercise_targets")
    .select("*")
    .eq("patient_id", childId);
  if (error) throw error;

  return (data ?? []).map((row) => ({
    childId: row.patient_id,
    exerciseSlug: row.exercise_slug,
    side: (row.side as "left" | "right" | null) ?? undefined,
    customAngleTargets:
      row.target_angle_primary !== null || row.target_angle_secondary !== null
        ? {
            primary: row.target_angle_primary ?? undefined,
            secondary: row.target_angle_secondary ?? undefined,
          }
        : undefined,
    customDurationTargetSeconds: row.target_duration_seconds ?? undefined,
    customRepsTarget: row.target_reps ?? undefined,
    setBy: row.set_by,
    updatedAt: row.updated_at,
    note: row.note ?? undefined,
  }));
}

/** Creates or updates the override for one child + exercise (+ side). */
export async function saveChildExerciseTarget(
  override: ChildExerciseTargetOverride,
): Promise<void> {
  const row = {
    patient_id: override.childId,
    exercise_slug: resolveTargetSlug(override.exerciseSlug),
    side: override.side ?? null,
    target_angle_primary: override.customAngleTargets?.primary ?? null,
    target_angle_secondary: override.customAngleTargets?.secondary ?? null,
    target_duration_seconds: override.customDurationTargetSeconds ?? null,
    target_reps: override.customRepsTarget ?? null,
    set_by: override.setBy,
    note: override.note ?? null,
    updated_at: new Date().toISOString(),
  };

  const existing = await supabase
    .from("child_exercise_targets")
    .select("id")
    .eq("patient_id", row.patient_id)
    .eq("exercise_slug", row.exercise_slug)
    .is("side", row.side === null ? null : undefined as never)
    .maybeSingle();

  // `.is` above only applies when side is null; handle the sided case explicitly.
  let existingId: string | null = existing.data?.id ?? null;
  if (row.side !== null) {
    const sided = await supabase
      .from("child_exercise_targets")
      .select("id")
      .eq("patient_id", row.patient_id)
      .eq("exercise_slug", row.exercise_slug)
      .eq("side", row.side)
      .maybeSingle();
    existingId = sided.data?.id ?? null;
  }

  if (existingId) {
    const { error } = await supabase
      .from("child_exercise_targets")
      .update(row)
      .eq("id", existingId);
    if (error) throw error;
    return;
  }

  const { error } = await supabase.from("child_exercise_targets").insert(row);
  if (error) throw error;
}
