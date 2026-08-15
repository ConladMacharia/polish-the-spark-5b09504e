// The 6 reusable tracking mechanics for the child games (Rafiki's Island).
// All functions take normalized MediaPipe hand landmarks (0..1 coords).

export type Point = { x: number; y: number; z?: number };
export type Hand = Point[]; // 21 landmarks

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

function dist(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Hand scale reference so distances are size-invariant. */
export function handSpan(hand: Hand): number {
  return Math.max(0.06, dist(hand[LM.WRIST], hand[LM.MIDDLE_MCP]));
}

/** Mechanic A — pinch: thumb tip to index tip, normalized by hand size (0 = closed). */
export function pinchAmount(hand: Hand): number {
  return dist(hand[LM.THUMB_TIP], hand[LM.INDEX_TIP]) / handSpan(hand);
}

export function isPinching(hand: Hand, tolerance: number): boolean {
  return pinchAmount(hand) < tolerance;
}

/** Mechanic B — hand as cursor: palm center in normalized coords. */
export function palmCenter(hand: Hand): Point {
  const ids = [LM.WRIST, LM.INDEX_MCP, LM.MIDDLE_MCP, LM.RING_MCP, LM.PINKY_MCP];
  const x = ids.reduce((s, i) => s + hand[i].x, 0) / ids.length;
  const y = ids.reduce((s, i) => s + hand[i].y, 0) / ids.length;
  return { x, y };
}

/** Mechanic C — fist close: 0 = fully closed, 1+ = open. */
export function fistClosure(hand: Hand): number {
  const center = palmCenter(hand);
  const tips = [LM.INDEX_TIP, LM.MIDDLE_TIP, LM.RING_TIP, LM.PINKY_TIP];
  const avg = tips.reduce((s, i) => s + dist(hand[i], center), 0) / tips.length;
  return avg / handSpan(hand);
}

export function isFistClosed(hand: Hand, tolerance: number): boolean {
  return fistClosure(hand) < tolerance;
}

/** Mechanic D — cross-midline reach: has the wrist crossed the body-centre line? */
export function crossesMidline(hand: Hand, midlineX: number, side: "left" | "right"): boolean {
  const x = hand[LM.WRIST].x;
  return side === "left" ? x > midlineX + 0.04 : x < midlineX - 0.04;
}

/** Mechanic E — sequential thumb touch: which finger is the thumb currently touching. */
export function thumbTouchIndex(hand: Hand, tolerance: number): number | null {
  const tips = [LM.INDEX_TIP, LM.MIDDLE_TIP, LM.RING_TIP, LM.PINKY_TIP];
  const span = handSpan(hand);
  let best: { i: number; d: number } | null = null;
  tips.forEach((tip, i) => {
    const d = dist(hand[LM.THUMB_TIP], hand[tip]) / span;
    if (d < tolerance && (!best || d < best.d)) best = { i, d };
  });
  return best ? (best as { i: number }).i : null;
}

/** Two-finger scissor motion (index + middle spread), normalized. */
export function scissorAmount(hand: Hand): number {
  return dist(hand[LM.INDEX_TIP], hand[LM.MIDDLE_TIP]) / handSpan(hand);
}

/** Mechanic F — two-wrist symmetry: midpoint + how steady the spacing is. */
export function twoWristSymmetry(
  a: Hand,
  b: Hand,
  targetSpread: number,
  tolerance: number
): { center: Point; spread: number; steady: boolean } {
  const wa = a[LM.WRIST];
  const wb = b[LM.WRIST];
  const spread = dist(wa, wb);
  return {
    center: { x: (wa.x + wb.x) / 2, y: (wa.y + wb.y) / 2 },
    spread,
    steady: Math.abs(spread - targetSpread) < tolerance,
  };
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
