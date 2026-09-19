// src/lib/pose/angleUtils.ts
// Reusable 3-point vector angle calculation + upper limb joint mappings.

export interface Point2D {
  x: number;
  y: number;
}

// MediaPipe Pose landmark indices (33-point model)
export const POSE_LANDMARKS = {
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
} as const;

/**
 * Core 3-point vector angle formula.
 * B is always the joint vertex — the point the angle is measured AT.
 * Returns the interior angle at B, in degrees (0-180).
 */
export function calculateAngle(A: Point2D, B: Point2D, C: Point2D): number {
  const v1 = { x: A.x - B.x, y: A.y - B.y };
  const v2 = { x: C.x - B.x, y: C.y - B.y };

  const dot = v1.x * v2.x + v1.y * v2.y;
  const mag1 = Math.sqrt(v1.x ** 2 + v1.y ** 2);
  const mag2 = Math.sqrt(v2.x ** 2 + v2.y ** 2);

  if (mag1 === 0 || mag2 === 0) return 0; // guard against missing/overlapping landmarks

  // Clamp to [-1, 1] to avoid NaN from floating point rounding errors
  const cosAngle = Math.min(1, Math.max(-1, dot / (mag1 * mag2)));
  const angleRad = Math.acos(cosAngle);

  return angleRad * (180 / Math.PI);
}

export type Side = "left" | "right";

/** Below this visibility/presence score, MediaPipe itself is telling us
 *  the joint is occluded, off-frame, or a guess — not something to trust
 *  for a coaching angle. */
export const MIN_LANDMARK_VISIBILITY = 0.5;

/** True only if every given landmark is confident enough to trust for an
 *  angle calculation this frame. Landmarks with no visibility score at
 *  all (older/mocked data) are treated as trusted, to stay backward
 *  compatible with callers that don't provide one. */
export function landmarksAreReliable(
  points: Array<{ visibility?: number }>,
  indices: number[],
): boolean {
  return indices.every((i) => {
    const v = points[i]?.visibility;
    return v === undefined || v >= MIN_LANDMARK_VISIBILITY;
  });
}

/** Which raw landmark indices a given movement's angle depends on —
 *  used with landmarksAreReliable() before trusting a computed angle. */
export function landmarksForMovement(movement: "elbow" | "shoulderFlexion", side: Side): number[] {
  if (movement === "elbow") {
    return side === "left"
      ? [POSE_LANDMARKS.LEFT_SHOULDER, POSE_LANDMARKS.LEFT_ELBOW, POSE_LANDMARKS.LEFT_WRIST]
      : [POSE_LANDMARKS.RIGHT_SHOULDER, POSE_LANDMARKS.RIGHT_ELBOW, POSE_LANDMARKS.RIGHT_WRIST];
  }
  return side === "left"
    ? [POSE_LANDMARKS.LEFT_HIP, POSE_LANDMARKS.LEFT_SHOULDER, POSE_LANDMARKS.LEFT_ELBOW]
    : [POSE_LANDMARKS.RIGHT_HIP, POSE_LANDMARKS.RIGHT_SHOULDER, POSE_LANDMARKS.RIGHT_ELBOW];
}

/**
 * Elbow flexion/extension angle.
 * ~180° = fully straight arm. Low angle = fully bent.
 */
export function getElbowAngle(landmarks: Point2D[], side: Side): number {
  const shoulder =
    landmarks[side === "left" ? POSE_LANDMARKS.LEFT_SHOULDER : POSE_LANDMARKS.RIGHT_SHOULDER];
  const elbow =
    landmarks[side === "left" ? POSE_LANDMARKS.LEFT_ELBOW : POSE_LANDMARKS.RIGHT_ELBOW];
  const wrist =
    landmarks[side === "left" ? POSE_LANDMARKS.LEFT_WRIST : POSE_LANDMARKS.RIGHT_WRIST];

  return calculateAngle(shoulder, elbow, wrist);
}

/**
 * Shoulder flexion angle (arm raising forward — film from the side).
 * Uses hip as the fixed torso reference line.
 */
export function getShoulderFlexionAngle(landmarks: Point2D[], side: Side): number {
  const hip = landmarks[side === "left" ? POSE_LANDMARKS.LEFT_HIP : POSE_LANDMARKS.RIGHT_HIP];
  const shoulder =
    landmarks[side === "left" ? POSE_LANDMARKS.LEFT_SHOULDER : POSE_LANDMARKS.RIGHT_SHOULDER];
  const elbow =
    landmarks[side === "left" ? POSE_LANDMARKS.LEFT_ELBOW : POSE_LANDMARKS.RIGHT_ELBOW];

  return calculateAngle(hip, shoulder, elbow);
}

/**
 * Shoulder abduction angle (arm raising sideways — film from the front).
 * Same landmark triplet as flexion; the camera plane is what differs.
 */
export function getShoulderAbductionAngle(landmarks: Point2D[], side: Side): number {
  return getShoulderFlexionAngle(landmarks, side); // identical math, different camera setup
}

/**
 * One Euro Filter (Casiez, Roussel, Vogel 2012) — one dimension.
 * The standard adaptive low-pass filter for real-time landmark/cursor
 * tracking: it increases smoothing when the signal is nearly still
 * (killing jitter) and decreases smoothing when it's moving fast
 * (avoiding the lag a fixed-alpha filter would add). This is what makes
 * the skeleton overlay track a moving limb tightly while staying calm
 * when the child is holding a position.
 */
class OneEuroFilter1D {
  private xPrev: number | null = null;
  private dxPrev = 0;
  private tPrevMs: number | null = null;

  constructor(
    private minCutoff = 1.2, // Hz — higher = less smoothing at rest
    private beta = 1.0, // higher = reacts faster to quick movement
    private dCutoff = 1.0, // Hz — smoothing applied to the velocity estimate itself
  ) {}

  private alpha(cutoff: number, dtSeconds: number): number {
    const tau = 1 / (2 * Math.PI * cutoff);
    return 1 / (1 + tau / dtSeconds);
  }

  filter(x: number, tMs: number): number {
    if (this.tPrevMs === null || this.xPrev === null) {
      this.tPrevMs = tMs;
      this.xPrev = x;
      this.dxPrev = 0;
      return x;
    }
    // Floor dt so a dropped/duplicate frame timestamp can't divide-by-~0.
    const dt = Math.max((tMs - this.tPrevMs) / 1000, 1 / 120);
    this.tPrevMs = tMs;

    const dx = (x - this.xPrev) / dt;
    const aD = this.alpha(this.dCutoff, dt);
    this.dxPrev = aD * dx + (1 - aD) * this.dxPrev;

    const cutoff = this.minCutoff + this.beta * Math.abs(this.dxPrev);
    const a = this.alpha(cutoff, dt);
    const xFiltered = a * x + (1 - a) * this.xPrev;
    this.xPrev = xFiltered;
    return xFiltered;
  }
}

/**
 * Per-landmark-point smoother, now backed by a One Euro Filter on each
 * axis. Keep one instance PER landmark index you want to smooth (see
 * usage in app.exercises.tsx) — mixing multiple points through one
 * instance would corrupt its velocity estimate.
 */
export class LandmarkSmoother {
  private fx: OneEuroFilter1D;
  private fy: OneEuroFilter1D;

  constructor(minCutoff = 1.2, beta = 1.0) {
    this.fx = new OneEuroFilter1D(minCutoff, beta);
    this.fy = new OneEuroFilter1D(minCutoff, beta);
  }

  update(newPoint: Point2D): Point2D {
    const t = performance.now();
    return {
      x: this.fx.filter(newPoint.x, t),
      y: this.fy.filter(newPoint.y, t),
    };
  }
}

/**
 * Tracks the max (or min) angle reached during an active exercise rep.
 * Pure data capture — no pass/fail judgment, per Phase 2 scope.
 */
export class AngleRecorder {
  private maxAngle = -Infinity;
  private minAngle = Infinity;

  record(angle: number): void {
    if (angle > this.maxAngle) this.maxAngle = angle;
    if (angle < this.minAngle) this.minAngle = angle;
  }

  getMax(): number | null {
    return this.maxAngle === -Infinity ? null : this.maxAngle;
  }

  getMin(): number | null {
    return this.minAngle === Infinity ? null : this.minAngle;
  }

  reset(): void {
    this.maxAngle = -Infinity;
    this.minAngle = Infinity;
  }
}
