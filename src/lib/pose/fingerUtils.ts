// src/lib/pose/fingerUtils.ts
// Thumb-to-fingertip distance calculations for Mechanic E (sequential thumb touch).
// Distances are normalized against hand size so thresholds work regardless of
// how close/far the hand is from the camera.

export interface Point2D {
  x: number;
  y: number;
}

export const HAND_LANDMARKS = {
  WRIST: 0,
  THUMB_TIP: 4,
  INDEX_MCP: 5, // used as the hand-scale reference point
  INDEX_TIP: 8,
  MIDDLE_TIP: 12,
  RING_TIP: 16,
  PINKY_TIP: 20,
} as const;

export type FingerName = "index" | "middle" | "ring" | "pinky";

function dist(a: Point2D, b: Point2D): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

/**
 * Returns the thumb-to-each-fingertip distance, normalized by dividing by
 * the wrist-to-index-MCP distance (a rough proxy for hand size in frame).
 * This keeps thresholds meaningful whether the hand is close to or far
 * from the camera — a raw pixel distance would break as the child moves.
 */
export function getFingerDistances(landmarks: Point2D[]): Record<FingerName, number> {
  const wrist = landmarks[HAND_LANDMARKS.WRIST];
  const indexMcp = landmarks[HAND_LANDMARKS.INDEX_MCP];
  const scale = dist(wrist, indexMcp) || 1; // guard against divide-by-zero

  const thumb = landmarks[HAND_LANDMARKS.THUMB_TIP];

  return {
    index: dist(thumb, landmarks[HAND_LANDMARKS.INDEX_TIP]) / scale,
    middle: dist(thumb, landmarks[HAND_LANDMARKS.MIDDLE_TIP]) / scale,
    ring: dist(thumb, landmarks[HAND_LANDMARKS.RING_TIP]) / scale,
    pinky: dist(thumb, landmarks[HAND_LANDMARKS.PINKY_TIP]) / scale,
  };
}

/**
 * Determines which finger, if any, is currently "touching" the thumb.
 * Requires the target finger's distance to be below TOUCH_THRESHOLD AND
 * meaningfully closer than the other three fingers — this is what stops
 * a full hand-close from triggering every finger as "touched" at once.
 */
const TOUCH_THRESHOLD = 0.35; // tune based on real testing — start generous
const SEPARATION_MARGIN = 1.3; // target must be this much closer than 2nd-closest

export function getActiveFinger(
  distances: Record<FingerName, number>,
  touchThreshold: number = TOUCH_THRESHOLD
): FingerName | null {
  const entries = Object.entries(distances) as [FingerName, number][];
  entries.sort((a, b) => a[1] - b[1]);

  const [closestName, closestDist] = entries[0];
  const [, secondDist] = entries[1];

  if (closestDist > touchThreshold) return null; // nothing close enough to thumb
  if (secondDist < closestDist * SEPARATION_MARGIN) return null; // too ambiguous — two fingers equally close

  return closestName;
}

export { TOUCH_THRESHOLD };
