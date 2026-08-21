// src/lib/pose/adaptiveTracking.ts
// Shared confidence-aware smoothing + pinch hysteresis for every camera game.
//
// Why this exists: a fixed smoothing factor is always wrong somewhere. In dim
// light MediaPipe's landmarks jitter, so a fast filter shakes the cursor; in
// bright light with a fast-moving hand a slow filter lags behind. The same is
// true of pinch thresholds — a noisy hand flickers in and out of "pinched".
//
// So both are made adaptive:
//   * confidence  (from MediaPipe handedness score + landmark stability)
//                 low  -> heavier smoothing, wider hysteresis, longer grace
//   * speed       fast -> lighter smoothing so quick motion never lags
//
// Everything here is framework-free and separately testable.

export type Pt = { x: number; y: number };

/* ── CONFIDENCE ─────────────────────────────────────────────────────────── */

/** Minimal shape we need out of a HandLandmarkerResult (keeps this testable). */
export interface ConfidenceSource {
  handedness?: { score?: number }[][];
  landmarks?: { x: number; y: number; z?: number }[][];
}

/**
 * 0..1 tracking confidence for one detected hand. MediaPipe's handedness score
 * is the only per-hand quality signal the Tasks API exposes; it sits ~0.95 in
 * good light and sags in poor light / partial occlusion. We rescale it so the
 * usable 0.55..0.98 band spans the full 0..1 range that the filters consume.
 */
export function handConfidence(result: ConfidenceSource, index = 0): number {
  const score = result.handedness?.[index]?.[0]?.score;
  if (typeof score !== "number" || Number.isNaN(score)) return 0.6; // unknown: assume middling
  return clamp01((score - 0.55) / (0.98 - 0.55));
}

/**
 * Tracks how much the landmarks are shaking frame to frame and turns that into
 * a confidence penalty. Lighting noise shows up as jitter long before the
 * handedness score drops, so this catches what handConfidence misses.
 */
export class JitterMonitor {
  private prev: Pt | null = null;
  private jitter = 0;

  /** Feed one reference point per frame (palm center or pinch midpoint). */
  push(p: Pt): number {
    if (this.prev) {
      const d = Math.hypot(p.x - this.prev.x, p.y - this.prev.y);
      // slow EMA of frame-to-frame motion magnitude
      this.jitter += (d - this.jitter) * 0.12;
    }
    this.prev = { x: p.x, y: p.y };
    return this.jitter;
  }

  /** 1 = steady, ->0 = very shaky. Normalized in units of hand-span/frame. */
  get stability(): number {
    return clamp01(1 - this.jitter / 0.06);
  }

  reset() {
    this.prev = null;
    this.jitter = 0;
  }
}

/** Blend the two signals into the single confidence value the filters take. */
export function blendConfidence(handednessConf: number, stability: number): number {
  return clamp01(handednessConf * 0.55 + stability * 0.45);
}

/* ── ADAPTIVE SMOOTHING ─────────────────────────────────────────────────── */

export interface AdaptiveSmoothingOptions {
  /** Smoothing factor floor — used when confidence is lowest (max damping). */
  minAlpha?: number;
  /** Smoothing factor ceiling — used at full confidence / fast motion. */
  maxAlpha?: number;
  /** Motion (per frame, in input units) treated as "fast" for lag rejection. */
  fastMotion?: number;
}

/**
 * Chooses an exponential smoothing factor for this frame.
 * Low confidence pulls alpha toward minAlpha (steady but slightly laggy);
 * fast movement pushes it back up toward maxAlpha (responsive, no drag).
 */
export function adaptiveAlpha(
  confidence: number,
  motion: number,
  opts: AdaptiveSmoothingOptions = {}
): number {
  const minAlpha = opts.minAlpha ?? 0.35;
  const maxAlpha = opts.maxAlpha ?? 0.95;
  const fastMotion = opts.fastMotion ?? 0.03;

  const base = minAlpha + (maxAlpha - minAlpha) * clamp01(confidence);
  const speedBoost = clamp01(motion / fastMotion) * (maxAlpha - base);
  return clamp(base + speedBoost, minAlpha, maxAlpha);
}

/** Confidence- and speed-aware 1D smoother. */
export class AdaptiveScalar {
  private current: number | null = null;
  constructor(private opts: AdaptiveSmoothingOptions = {}) {}

  push(value: number, confidence: number): number {
    if (this.current === null) {
      this.current = value;
      return value;
    }
    const motion = Math.abs(value - this.current);
    const a = adaptiveAlpha(confidence, motion, this.opts);
    this.current += (value - this.current) * a;
    return this.current;
  }

  get value(): number | null {
    return this.current;
  }

  reset() {
    this.current = null;
  }
}

/** Confidence- and speed-aware 2D point smoother. */
export class AdaptivePointSmoother {
  private current: Pt | null = null;
  constructor(private opts: AdaptiveSmoothingOptions = {}) {}

  push(p: Pt, confidence: number): Pt {
    if (!this.current) {
      this.current = { x: p.x, y: p.y };
      return this.current;
    }
    const motion = Math.hypot(p.x - this.current.x, p.y - this.current.y);
    const a = adaptiveAlpha(confidence, motion, this.opts);
    this.current = {
      x: this.current.x + (p.x - this.current.x) * a,
      y: this.current.y + (p.y - this.current.y) * a,
    };
    return this.current;
  }

  reset() {
    this.current = null;
  }
}

/* ── ADAPTIVE PINCH HYSTERESIS ──────────────────────────────────────────── */

export interface AdaptivePinchOptions {
  /** Engage threshold at full confidence (normalized thumb↔index distance). */
  closeAt?: number;
  /** Release threshold at full confidence. Must be > closeAt. */
  releaseAt?: number;
  /** Extra hysteresis width added when confidence is 0 (as a multiplier). */
  lowConfidenceWiden?: number;
  /** Dropout grace at full confidence, in ms. Scales up when confidence drops. */
  graceMs?: number;
}

/**
 * Pinch detector with a confidence-scaled hysteresis band. Noisy tracking gets
 * a wider gap between "close" and "release" plus a longer dropout grace, so a
 * held pinch never flickers; clean tracking gets a tight, crisp band.
 */
export class AdaptivePinch {
  private closed = false;
  private lastClosedAt = 0;

  constructor(private opts: AdaptivePinchOptions = {}) {}

  /**
   * @param distance   normalized thumb↔index distance (divide by hand span)
   * @param confidence 0..1 blended tracking confidence
   * @param now        performance.now()
   */
  update(distance: number, confidence: number, now: number): boolean {
    const closeAt = this.opts.closeAt ?? 0.065;
    const releaseAt = this.opts.releaseAt ?? 0.085;
    const widen = this.opts.lowConfidenceWiden ?? 0.6;
    const graceMs = this.opts.graceMs ?? 140;

    const slack = 1 + (1 - clamp01(confidence)) * widen;
    const threshold = (this.closed ? releaseAt : closeAt) * slack;
    const grace = graceMs * slack;

    if (distance < threshold) {
      this.closed = true;
      this.lastClosedAt = now;
    } else if (this.closed && now - this.lastClosedAt > grace) {
      this.closed = false;
    }
    return this.closed;
  }

  /** Tracking lost this frame — keep the pinch alive only inside the grace. */
  markMissing(confidence: number, now: number): boolean {
    const grace = (this.opts.graceMs ?? 140) * (1 + (1 - clamp01(confidence)) * (this.opts.lowConfidenceWiden ?? 0.6));
    if (this.closed && now - this.lastClosedAt > grace) this.closed = false;
    return this.closed;
  }

  get isPinched() {
    return this.closed;
  }

  reset() {
    this.closed = false;
    this.lastClosedAt = 0;
  }
}

/**
 * Scales any gesture tolerance (pinch/touch/dwell thresholds) by confidence, so
 * a shaky hand in poor light is judged a little more generously instead of
 * simply failing. Never tightens below the caller's baseline.
 */
export function tolerantThreshold(base: number, confidence: number, widen = 0.5): number {
  return base * (1 + (1 - clamp01(confidence)) * widen);
}

/* ── helpers ────────────────────────────────────────────────────────────── */

function clamp01(v: number) {
  return clamp(v, 0, 1);
}
function clamp(v: number, lo: number, hi: number) {
  return v < lo ? lo : v > hi ? hi : v;
}
