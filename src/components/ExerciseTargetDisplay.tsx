// src/components/ExerciseTargetDisplay.tsx
//
// Two pieces:
// 1. useExerciseTarget — hook to get the effective target for live display
//    alongside the tracked angle (e.g. "Current: 142° · Target: 170°")
// 2. TherapistTargetEditor — form for a PT/OT to set a custom target for
//    a specific child + exercise. Wire onSave to your actual data layer
//    (Supabase, etc.) — this component doesn't assume a backend.

import { useState } from "react";
import {
  getEffectiveTarget,
  getDefaultConfig,
  type ChildExerciseTargetOverride,
} from "@/lib/exercise-targets";
import { saveChildExerciseTarget } from "@/lib/exercise-targets.data";

// ---------- Hook for live tracking screens ----------

export function useExerciseTarget(
  exerciseSlug: string,
  childId: string,
  overrides: ChildExerciseTargetOverride[],
  side?: "left" | "right"
) {
  return getEffectiveTarget(exerciseSlug, overrides, childId, side);
}

// ---------- Simple live display component ----------

interface TargetBadgeProps {
  liveAngle: number | null;
  exerciseSlug: string;
  childId: string;
  overrides: ChildExerciseTargetOverride[];
  side?: "left" | "right";
}

export function TargetBadge({
  liveAngle,
  exerciseSlug,
  childId,
  overrides,
  side,
}: TargetBadgeProps) {
  const target = useExerciseTarget(exerciseSlug, childId, overrides, side);

  if (!target) return null;

  if (target.targetType === "angle" && target.angle) {
    return (
      <div style={{ textAlign: "center", fontSize: 14 }}>
        <span style={{ fontWeight: 700, fontSize: 28 }}>
          {liveAngle !== null ? `${liveAngle}°` : "—"}
        </span>
        <span style={{ opacity: 0.6, marginLeft: 8 }}>
          Target: {target.angle.primary}°
          {target.angle.primaryLabel ? ` (${target.angle.primaryLabel})` : ""}
        </span>
        {target.angle.secondary !== undefined && (
          <div style={{ opacity: 0.6 }}>
            {target.angle.secondaryLabel}: {target.angle.secondary}°
          </div>
        )}
        {target.source === "custom" && (
          <div style={{ fontSize: 11, opacity: 0.5, marginTop: 2 }}>
            Custom target set by therapist
            {target.note ? ` — ${target.note}` : ""}
          </div>
        )}
      </div>
    );
  }

  if (target.targetType === "duration") {
    return (
      <div style={{ textAlign: "center", fontSize: 14 }}>
        Target hold: {target.durationSeconds}s
        {target.source === "custom" && (
          <div style={{ fontSize: 11, opacity: 0.5 }}>Custom target</div>
        )}
      </div>
    );
  }

  if (target.targetType === "reps") {
    return (
      <div style={{ textAlign: "center", fontSize: 14 }}>
        Target: {target.reps} reps
        {target.source === "custom" && (
          <div style={{ fontSize: 11, opacity: 0.5 }}>Custom target</div>
        )}
      </div>
    );
  }

  return null;
}

// ---------- Therapist-facing editor ----------

interface TherapistTargetEditorProps {
  childId: string;
  childName: string;
  exerciseSlug: string;
  therapistName: string;
  existingOverride?: ChildExerciseTargetOverride;
  /** Optional. Defaults to saving into the backend targets table. */
  onSave?: (override: ChildExerciseTargetOverride) => Promise<void> | void;
}

export function TherapistTargetEditor({
  childId,
  childName,
  exerciseSlug,
  therapistName,
  existingOverride,
  onSave,
}: TherapistTargetEditorProps) {
  const defaultConfig = getDefaultConfig(exerciseSlug);
  const [primary, setPrimary] = useState<string>(
    existingOverride?.customAngleTargets?.primary?.toString() ??
      defaultConfig?.angleTargets?.primary?.toString() ??
      ""
  );
  const [secondary, setSecondary] = useState<string>(
    existingOverride?.customAngleTargets?.secondary?.toString() ??
      defaultConfig?.angleTargets?.secondary?.toString() ??
      ""
  );
  const [duration, setDuration] = useState<string>(
    existingOverride?.customDurationTargetSeconds?.toString() ??
      defaultConfig?.durationTargetSeconds?.toString() ??
      ""
  );
  const [reps, setReps] = useState<string>(
    existingOverride?.customRepsTarget?.toString() ??
      defaultConfig?.repsTarget?.toString() ??
      ""
  );
  const [note, setNote] = useState(existingOverride?.note ?? "");
  const [saving, setSaving] = useState(false);

  if (!defaultConfig) {
    return <div>Unknown exercise: {exerciseSlug}</div>;
  }

  const config = defaultConfig;

  async function handleSave() {
    setSaving(true);
    const override: ChildExerciseTargetOverride = {
      childId,
      exerciseSlug,
      customAngleTargets:
        config.targetType === "angle"
          ? {
              primary: primary ? Number(primary) : undefined,
              secondary: secondary ? Number(secondary) : undefined,
            }
          : undefined,
      customDurationTargetSeconds:
        config.targetType === "duration" && duration ? Number(duration) : undefined,
      customRepsTarget: config.targetType === "reps" && reps ? Number(reps) : undefined,
      setBy: therapistName,
      updatedAt: new Date().toISOString(),
      note: note || undefined,
    };
    try {
      if (onSave) await onSave(override);
      else await saveChildExerciseTarget(override);
    } finally {
      setSaving(false);
    }
  }


  return (
    <div style={{ maxWidth: 400, padding: 16 }}>
      <h3>
        {defaultConfig.name} — {childName}
      </h3>
      <p style={{ fontSize: 13, opacity: 0.7 }}>
        Clinical reference:{" "}
        {defaultConfig.targetType === "angle" &&
          `${defaultConfig.angleTargets?.primary}°${
            defaultConfig.angleTargets?.secondary
              ? ` / ${defaultConfig.angleTargets.secondary}°`
              : ""
          }`}
        {defaultConfig.targetType === "duration" && `${defaultConfig.durationTargetSeconds}s`}
        {defaultConfig.targetType === "reps" && `${defaultConfig.repsTarget} reps`}
        {" — adjust below for this child specifically."}
      </p>

      {defaultConfig.targetType === "angle" && (
        <>
          <label style={{ display: "block", marginTop: 8 }}>
            {defaultConfig.angleTargets?.primaryLabel ?? "Target angle"} (°)
            <input
              type="number"
              value={primary}
              onChange={(e) => setPrimary(e.target.value)}
              style={{ display: "block", width: "100%" }}
            />
          </label>
          {defaultConfig.angleTargets?.secondary !== undefined && (
            <label style={{ display: "block", marginTop: 8 }}>
              {defaultConfig.angleTargets?.secondaryLabel ?? "Secondary target"} (°)
              <input
                type="number"
                value={secondary}
                onChange={(e) => setSecondary(e.target.value)}
                style={{ display: "block", width: "100%" }}
              />
            </label>
          )}
        </>
      )}

      {defaultConfig.targetType === "duration" && (
        <label style={{ display: "block", marginTop: 8 }}>
          Target hold duration (seconds)
          <input
            type="number"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            style={{ display: "block", width: "100%" }}
          />
        </label>
      )}

      {defaultConfig.targetType === "reps" && (
        <label style={{ display: "block", marginTop: 8 }}>
          Target repetitions
          <input
            type="number"
            value={reps}
            onChange={(e) => setReps(e.target.value)}
            style={{ display: "block", width: "100%" }}
          />
        </label>
      )}

      <label style={{ display: "block", marginTop: 8 }}>
        Note (optional — e.g. reason for adjustment)
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          style={{ display: "block", width: "100%" }}
        />
      </label>

      <button onClick={handleSave} disabled={saving} style={{ marginTop: 12 }}>
        {saving ? "Saving..." : "Save target for this child"}
      </button>
    </div>
  );
}
