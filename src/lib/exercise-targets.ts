// src/lib/exercise-targets.ts
//
// Per-child, per-exercise target configuration.
// Scope: Shoulder, Elbow, Wrist (upper body) + Hip, Knee, Ankle, Balance (lower body).
// Hand & Fingers intentionally excluded — handled separately in the child/gamified UX.

export type TargetType = "angle" | "duration" | "reps";

export type JointRegion =
  | "shoulder"
  | "elbow"
  | "wrist"
  | "hip"
  | "knee"
  | "ankle"
  | "balance";

/**
 * The clinical default target for an exercise — used until/unless a
 * therapist sets a custom value for a specific child.
 */
export interface ExerciseTargetDefault {
  slug: string;
  name: string;
  region: JointRegion;
  targetType: TargetType;
  // For targetType "angle": the goal angle(s) in degrees.
  // Some exercises have two directions (e.g. rotation: internal + external).
  angleTargets?: {
    primary: number;
    secondary?: number; // e.g. internal/external, radial/ulnar
    primaryLabel?: string;
    secondaryLabel?: string;
  };
  // For targetType "duration": goal hold time in seconds.
  durationTargetSeconds?: number;
  // For targetType "reps": goal repetitions per session.
  repsTarget?: number;
  // Which joints/landmarks this exercise involves — supports compound
  // exercises like Bridge Lift or High March that span two regions.
  relatedRegions?: JointRegion[];
}

/**
 * Clinical reference defaults. These are general goniometry-based
 * starting points, NOT prescriptions — a treating PT/OT should review
 * and adjust per child, especially given contractures or spasticity
 * common in CP. See ChildExerciseTargetOverride below for the
 * per-child customization layer.
 */
export const EXERCISE_TARGET_DEFAULTS: ExerciseTargetDefault[] = [
  // ---------- SHOULDER ----------
  {
    slug: "forward-reach",
    name: "Forward reach",
    region: "shoulder",
    targetType: "angle",
    angleTargets: { primary: 180, primaryLabel: "Flexion" },
  },
  {
    slug: "arm-lowering",
    name: "Arm lowering",
    region: "shoulder",
    targetType: "angle",
    angleTargets: { primary: 60, primaryLabel: "Extension" },
  },
  {
    slug: "side-reach",
    name: "Side reach",
    region: "shoulder",
    targetType: "angle",
    angleTargets: { primary: 180, primaryLabel: "Abduction" },
  },
  {
    slug: "cross-body-reach",
    name: "Cross body reach",
    region: "shoulder",
    targetType: "angle",
    angleTargets: { primary: 50, primaryLabel: "Adduction" },
  },
  {
    slug: "rotation",
    name: "Rotation",
    region: "shoulder",
    targetType: "angle",
    angleTargets: {
      primary: 70,
      primaryLabel: "Internal rotation",
      secondary: 90,
      secondaryLabel: "External rotation",
    },
  },

  // ---------- ELBOW ----------
  {
    slug: "bend-and-straighten",
    name: "Bend and straighten",
    region: "elbow",
    targetType: "angle",
    angleTargets: {
      primary: 145,
      primaryLabel: "Flexion (bend)",
      secondary: 180,
      secondaryLabel: "Extension (straighten)",
    },
  },
  {
    slug: "palm-up-palm-down",
    name: "Palm up, palm down",
    region: "elbow",
    targetType: "angle",
    angleTargets: {
      primary: 80,
      primaryLabel: "Supination",
      secondary: 80,
      secondaryLabel: "Pronation",
    },
  },

  // ---------- WRIST ----------
  {
    slug: "wrist-bend-up",
    name: "Wrist bend up",
    region: "wrist",
    targetType: "angle",
    angleTargets: { primary: 70, primaryLabel: "Extension" },
  },
  {
    slug: "wrist-bend-down",
    name: "Wrist bend down",
    region: "wrist",
    targetType: "angle",
    angleTargets: { primary: 80, primaryLabel: "Flexion" },
  },
  {
    slug: "side-to-side-wrist-tilt",
    name: "Side to side wrist tilt",
    region: "wrist",
    targetType: "angle",
    angleTargets: {
      primary: 20,
      primaryLabel: "Radial deviation",
      secondary: 30,
      secondaryLabel: "Ulnar deviation",
    },
  },

  // ---------- HIP ----------
  {
    slug: "leg-kick",
    name: "Leg Kick",
    region: "hip",
    targetType: "angle",
    angleTargets: { primary: 90, primaryLabel: "Hip flexion" },
  },
  {
    slug: "high-march",
    name: "High March",
    region: "hip",
    relatedRegions: ["knee"],
    targetType: "reps",
    repsTarget: 10, // e.g. 10 steps per leg — adjust per child
  },
  {
    slug: "hip-abduction",
    name: "Hip Abduction",
    region: "hip",
    targetType: "angle",
    angleTargets: { primary: 45, primaryLabel: "Abduction" },
  },
  {
    slug: "bridge-lift",
    name: "Bridge Lift",
    region: "hip",
    relatedRegions: ["knee"],
    targetType: "duration",
    durationTargetSeconds: 5, // hold at top of bridge
  },

  // ---------- KNEE ----------
  {
    slug: "mini-squat",
    name: "Mini Squat",
    region: "knee",
    targetType: "angle",
    angleTargets: { primary: 60, primaryLabel: "Knee flexion (quarter squat)" },
  },
  {
    slug: "knee-extension",
    name: "Knee Extension",
    region: "knee",
    targetType: "angle",
    angleTargets: { primary: 170, primaryLabel: "Extension (straighten)" },
  },
  {
    slug: "crawl-pattern",
    name: "Crawl Pattern",
    region: "knee",
    relatedRegions: ["hip"],
    targetType: "reps",
    repsTarget: 8, // cross-body cycles
  },

  // ---------- ANKLE ----------
  {
    slug: "ankle-pumps",
    name: "Ankle Pumps",
    region: "ankle",
    targetType: "angle",
    angleTargets: {
      primary: 20,
      primaryLabel: "Dorsiflexion",
      secondary: 50,
      secondaryLabel: "Plantarflexion",
    },
  },
  {
    slug: "toe-taps",
    name: "Toe Taps",
    region: "ankle",
    targetType: "reps",
    repsTarget: 15,
  },

  // ---------- BALANCE ----------
  {
    slug: "heel-to-toe-walk",
    name: "Heel-to-Toe Walk",
    region: "balance",
    targetType: "reps",
    repsTarget: 6, // steps in a line
  },
  {
    slug: "standing-balance",
    name: "Standing Balance",
    region: "balance",
    targetType: "duration",
    durationTargetSeconds: 30,
  },
  {
    slug: "lunge-reach",
    name: "Lunge Reach",
    region: "balance",
    relatedRegions: ["knee", "hip"],
    targetType: "angle",
    angleTargets: { primary: 90, primaryLabel: "Front knee angle at lunge depth" },
  },
  {
    slug: "single-leg-stand",
    name: "Single-Leg Stand",
    region: "balance",
    targetType: "duration",
    durationTargetSeconds: 15,
  },
];

/**
 * Per-child override — set by a treating PT/OT for a specific child,
 * exercise, and (where relevant) side. Falls back to the clinical
 * default above when no override exists.
 */
export interface ChildExerciseTargetOverride {
  childId: string;
  exerciseSlug: string;
  side?: "left" | "right"; // omit for exercises that aren't side-specific
  // Overrides — only set the field(s) relevant to that exercise's targetType
  customAngleTargets?: {
    primary?: number;
    secondary?: number;
  };
  customDurationTargetSeconds?: number;
  customRepsTarget?: number;
  setBy: string; // therapist name/id, for accountability
  updatedAt: string; // ISO timestamp
  note?: string; // e.g. "Reduced target due to right elbow contracture"
}

/**
 * Resolves the EFFECTIVE target for a given child + exercise + side —
 * the value that should actually be shown live during tracking.
 * Prefers a therapist-set override; falls back to the clinical default.
 *
 * This is a pure function — wire it to your real data source (Supabase,
 * etc.) by fetching the override list and default list, then calling this.
 */
export function getEffectiveTarget(
  exerciseSlug: string,
  overrides: ChildExerciseTargetOverride[],
  childId: string,
  side?: "left" | "right"
): {
  source: "custom" | "default";
  targetType: TargetType;
  angle?: { primary: number; secondary?: number; primaryLabel?: string; secondaryLabel?: string };
  durationSeconds?: number;
  reps?: number;
  note?: string;
} | null {
  const canonical = resolveTargetSlug(exerciseSlug);
  const defaultConfig = EXERCISE_TARGET_DEFAULTS.find((e) => e.slug === canonical);
  if (!defaultConfig) return null;

  const override = overrides.find(
    (o) =>
      o.childId === childId &&
      resolveTargetSlug(o.exerciseSlug) === canonical &&
      (o.side === side || (!o.side && !side))
  );


  if (override) {
    return {
      source: "custom",
      targetType: defaultConfig.targetType,
      angle: override.customAngleTargets
        ? {
            primary:
              override.customAngleTargets.primary ??
              defaultConfig.angleTargets?.primary ??
              0,
            secondary:
              override.customAngleTargets.secondary ??
              defaultConfig.angleTargets?.secondary,
            primaryLabel: defaultConfig.angleTargets?.primaryLabel,
            secondaryLabel: defaultConfig.angleTargets?.secondaryLabel,
          }
        : defaultConfig.angleTargets,
      durationSeconds:
        override.customDurationTargetSeconds ?? defaultConfig.durationTargetSeconds,
      reps: override.customRepsTarget ?? defaultConfig.repsTarget,
      note: override.note,
    };
  }

  return {
    source: "default",
    targetType: defaultConfig.targetType,
    angle: defaultConfig.angleTargets,
    durationSeconds: defaultConfig.durationTargetSeconds,
    reps: defaultConfig.repsTarget,
  };
}

/**
 * Convenience lookup for a default config by slug — useful when
 * building the therapist-facing "set custom target" form, so you can
 * show the clinical default as a placeholder/reference value.
 */
export function getDefaultConfig(slug: string): ExerciseTargetDefault | undefined {
  return EXERCISE_TARGET_DEFAULTS.find((e) => e.slug === resolveTargetSlug(slug));
}

/**
 * Maps the exercise slugs used by the app's exercise catalog / live session
 * to the canonical target slugs above.
 */
export const TARGET_SLUG_ALIASES: Record<string, string> = {
  arm: "forward-reach",
  "arm-raise": "forward-reach",
  "arm-circles": "arm-lowering",
  "side-bend": "side-reach",
  midline: "cross-body-reach",
  "wall-slide": "rotation",
  reach: "bend-and-straighten",
  shoulder: "palm-up-palm-down",
  draw: "wrist-bend-up",
  tracing: "wrist-bend-down",
  "page-turn": "side-to-side-wrist-tilt",
  leg: "leg-kick",
  "leg-kick": "leg-kick",
  march: "high-march",
  squat: "mini-squat",
  balance: "standing-balance",
  "single-leg": "single-leg-stand",
};

export function resolveTargetSlug(slug: string): string {
  return TARGET_SLUG_ALIASES[slug] ?? slug;
}
