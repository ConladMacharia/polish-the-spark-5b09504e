// The 6 reusable tracking mechanics for the child games (Rafiki's Island).
// Every function here is an independent, separately-testable unit that takes
// normalized MediaPipe hand landmarks (0..1 image coords).
//
//  A — pinch-to-grab .............. pinchDistance / isPinching
//  B — hand-as-cursor ............. palmCenter (continuous position)
//  C — fist-close ................. fistClosePercent (0..100, continuous)
//  D — cross-midline reach ........ hasCrossedMidline (needs handedness)
//  E — sequential thumb touch ..... thumbToFingerDistance / touchesFinger
//  F — two-wrist symmetry ......... wristSpread / isSpreadInRange
//  Special — scissor snip ......... scissorAmount + ScissorCycle

export type Point = { x: number; y: number; z?: number };
export type Hand = Point[]; // 21 landmarks
export type Handedness = "Left" | "Right";

export const LM = {
  WRIST: 0,
  THUMB_TIP: 4,
  INDEX_TIP: 8,
  MIDDLE_TIP: 12,
  RING_TIP: 16,
  PINKY_TIP: 20,
  INDEX_MCP: 5,
  MIDDLE_MCP: 9,
  RING_MCP: 13,
  PINKY_MCP: 17,
} as const;

/** The four non-thumb fingertips, in the order mechanic E steps through them. */
export const FINGER_TIPS = [LM.INDEX_TIP, LM.MIDDLE_TIP, LM.RING_TIP, LM.PINKY_TIP] as const;
export const FINGER_NAMES = ["pointer", "middle", "ring", "pinky"] as const;

function dist(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Hand scale reference so all distances are size- and depth-invariant. */
export function handSpan(hand: Hand): number {
  return Math.max(0.06, dist(hand[LM.WRIST], hand[LM.MIDDLE_MCP]));
}

/* ── MECHANIC A — pinch-to-grab ─────────────────────────────────────────── */
/** Thumb tip (4) ↔ index tip (8), normalized by hand size. 0 = fully closed. */
export function pinchDistance(hand: Hand): number {
  return dist(hand[LM.THUMB_TIP], hand[LM.INDEX_TIP]) / handSpan(hand);
}

/** Discrete pinch event test — near-zero thumb/index distance. */
export function isPinching(hand: Hand, tolerance: number): boolean {
  return pinchDistance(hand) < tolerance;
}

/** Rising-edge detector so one physical pinch fires exactly one event. */
export class PinchLatch {
  private closed = false;
  /** returns true only on the frame the hand transitions open → pinched */
  update(hand: Hand, tolerance: number): boolean {
    const d = pinchDistance(hand);
    if (!this.closed && d < tolerance) {
      this.closed = true;
      return true;
    }
    if (this.closed && d > tolerance * 1.6) this.closed = false;
    return false;
  }
  get isHeld() {
    return this.closed;
  }
  reset() {
    this.closed = false;
  }
}

/* ── MECHANIC B — hand as cursor ────────────────────────────────────────── */
/** Continuous palm-center position (mean of 0, 5, 9, 13, 17). No threshold. */
export function palmCenter(hand: Hand): Point {
  const ids: number[] = [LM.WRIST, LM.INDEX_MCP, LM.MIDDLE_MCP, LM.RING_MCP, LM.PINKY_MCP];
  const x = ids.reduce((s, i) => s + hand[i].x, 0) / ids.length;
  const y = ids.reduce((s, i) => s + hand[i].y, 0) / ids.length;
  return { x, y };
}

/* ── MECHANIC C — fist close (continuous) ───────────────────────────────── */
/** Mean fingertip → palm-center distance, normalized. ~0.4 closed, ~1.2 open. */
export function fistClosure(hand: Hand): number {
  const center = palmCenter(hand);
  const avg = FINGER_TIPS.reduce((s, i) => s + dist(hand[i], center), 0) / FINGER_TIPS.length;
  return avg / handSpan(hand);
}

const FIST_OPEN = 1.15;
const FIST_CLOSED = 0.45;

/** 0 = wide open, 100 = fully squeezed. Continuous, for proportional squish. */
export function fistClosePercent(hand: Hand): number {
  const raw = fistClosure(hand);
  const pct = ((FIST_OPEN - raw) / (FIST_OPEN - FIST_CLOSED)) * 100;
  return Math.max(0, Math.min(100, pct));
}

/* ── MECHANIC D — cross-midline reach ───────────────────────────────────── */
/**
 * Wrist (0) relative to the body's vertical centerline. Success when the RIGHT
 * hand crosses to the LEFT of the line, or the LEFT hand crosses to the RIGHT.
 * Coords are raw MediaPipe image coords (x grows to the image right), and
 * handedness comes from MediaPipe Hands.
 */
export function hasCrossedMidline(
  hand: Hand,
  handedness: Handedness,
  midlineX = 0.5,
  margin = 0.05
): boolean {
  const x = hand[LM.WRIST].x;
  // In an un-mirrored camera image the person's right hand appears on the left.
  return handedness === "Right" ? x > midlineX + margin : x < midlineX - margin;
}

/* ── MECHANIC E — sequential thumb touch ────────────────────────────────── */
/** Thumb tip to one specific fingertip (0=index,1=middle,2=ring,3=pinky). */
export function thumbToFingerDistance(hand: Hand, finger: 0 | 1 | 2 | 3): number {
  return dist(hand[LM.THUMB_TIP], hand[FINGER_TIPS[finger]]) / handSpan(hand);
}

/** Only the requested finger counts — a plain pinch on another finger does not. */
export function touchesFinger(hand: Hand, finger: 0 | 1 | 2 | 3, tolerance: number): boolean {
  return thumbToFingerDistance(hand, finger) < tolerance;
}

/** Rising-edge latch for one specific finger in the sequence. */
export class SequenceLatch {
  private touching = false;
  update(hand: Hand, finger: 0 | 1 | 2 | 3, tolerance: number): boolean {
    const d = thumbToFingerDistance(hand, finger);
    if (!this.touching && d < tolerance) {
      this.touching = true;
      return true;
    }
    if (this.touching && d > tolerance * 1.7) this.touching = false;
    return false;
  }
  reset() {
    this.touching = false;
  }
}

/* ── MECHANIC F — two-wrist symmetry ────────────────────────────────────── */
/** Raw distance between the two wrists (landmark 0 on each hand). */
export function wristSpread(a: Hand, b: Hand): number {
  return dist(a[LM.WRIST], b[LM.WRIST]);
}

export function wristMidpoint(a: Hand, b: Hand): Point {
  const wa = a[LM.WRIST];
  const wb = b[LM.WRIST];
  return { x: (wa.x + wb.x) / 2, y: (wa.y + wb.y) / 2 };
}

/** Both hands must stay a comfortable distance apart — not too close, not too far. */
export function isSpreadInRange(spread: number, target: number, tolerance: number): boolean {
  return Math.abs(spread - target) < tolerance;
}

export function twoWristSymmetry(
  a: Hand,
  b: Hand,
  targetSpread: number,
  tolerance: number
): { center: Point; spread: number; steady: boolean } {
  const spread = wristSpread(a, b);
  return {
    center: wristMidpoint(a, b),
    spread,
    steady: isSpreadInRange(spread, targetSpread, tolerance),
  };
}

/* ── SPECIAL — scissor snip (index/middle open-close) ───────────────────── */
/** Index tip (8) ↔ middle tip (12) spread, normalized. */
export function scissorAmount(hand: Hand): number {
  return dist(hand[LM.INDEX_TIP], hand[LM.MIDDLE_TIP]) / handSpan(hand);
}

/** Counts full open → close cycles of the two fingers (one snip per cycle). */
export class ScissorCycle {
  private opened = false;
  /** returns true on the frame a full open-then-close snip completes */
  update(hand: Hand, closeTolerance: number): boolean {
    const a = scissorAmount(hand);
    if (a > closeTolerance * 2.2) this.opened = true;
    else if (this.opened && a < closeTolerance) {
      this.opened = false;
      return true;
    }
    return false;
  }
  reset() {
    this.opened = false;
  }
}

/** Simple exponential smoothing for jittery landmark-derived points. */
export class PointSmoother {
  private current: Point | null = null;
  constructor(private alpha = 0.35) {}
  push(p: Point): Point {
    if (!this.current) this.current = { ...p };
    else {
      this.current = {
        x: this.current.x + (p.x - this.current.x) * this.alpha,
        y: this.current.y + (p.y - this.current.y) * this.alpha,
      };
    }
    return this.current;
  }
  reset() {
    this.current = null;
  }
}
