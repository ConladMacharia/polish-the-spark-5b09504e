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
 * Simple exponential moving average smoother — reduces jitter without
 * adding meaningful lag. Keep one instance of this PER landmark point
 * you want to smooth (see usage in LiveTrackingSession.tsx).
 */
export class LandmarkSmoother {
  private smoothed: Point2D | null = null;
  private readonly alpha: number;

  constructor(alpha = 0.3) {
    // alpha closer to 1 = less smoothing (more responsive)
    // alpha closer to 0 = more smoothing (more lag-resistant but slower to react)
    this.alpha = alpha;
  }

  update(newPoint: Point2D): Point2D {
    if (!this.smoothed) {
      this.smoothed = { ...newPoint };
      return this.smoothed;
    }
    this.smoothed = {
      x: this.smoothed.x * (1 - this.alpha) + newPoint.x * this.alpha,
      y: this.smoothed.y * (1 - this.alpha) + newPoint.y * this.alpha,
    };
    return this.smoothed;
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
