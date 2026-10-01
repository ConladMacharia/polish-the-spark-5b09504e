// src/lib/pose/poseLandmarker.ts
// Singleton loader — model initializes ONCE and is reused across camera sessions.
// This alone fixes most of the "slow to open" issue.

import { PoseLandmarker, type PoseLandmarkerResult } from "@mediapipe/tasks-vision";
import { getVision } from "@/lib/pose/vision";

const POSE_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

let poseLandmarkerInstance: PoseLandmarker | null = null;
let loadingPromise: Promise<PoseLandmarker> | null = null;

/**
 * Returns the shared PoseLandmarker instance, creating it only once.
 * Call this early (e.g. on app mount) to "warm up" the model before
 * the camera view opens, so there's no visible delay when the user
 * actually starts a session.
 */
export async function getPoseLandmarker(): Promise<PoseLandmarker> {
  if (poseLandmarkerInstance) {
    return poseLandmarkerInstance;
  }

  // Prevent duplicate simultaneous loads if called from multiple places
  if (loadingPromise) {
    return loadingPromise;
  }

  loadingPromise = (async () => {
    const vision = await getVision();

    // Lower confidences than the defaults: in dim rooms pose scores sag even
    // when the body is clearly visible, and the app already gates coaching on
    // its own confidence checks downstream.
    const options = (delegate: "GPU" | "CPU") => ({
      baseOptions: { modelAssetPath: POSE_MODEL_URL, delegate },
      runningMode: "VIDEO" as const, // required for correct real-time tracking
      numPoses: 1,
      minPoseDetectionConfidence: 0.4,
      minPosePresenceConfidence: 0.4,
      minTrackingConfidence: 0.4,
    });

    let landmarker: PoseLandmarker;
    try {
      landmarker = await PoseLandmarker.createFromOptions(vision, options("GPU"));
    } catch (err) {
      // No working WebGL delegate: fall back to CPU so it still starts.
      console.warn("PoseLandmarker GPU delegate unavailable, using CPU", err);
      landmarker = await PoseLandmarker.createFromOptions(vision, options("CPU"));
    }

    poseLandmarkerInstance = landmarker;
    return landmarker;
  })().catch((err) => {
    loadingPromise = null; // allow a retry instead of caching the failure
    throw err;
  });

  return loadingPromise;
}

/**
 * Call this once when your app shell mounts (e.g. in your root layout /
 * __root.tsx) so the model is already loaded by the time a caregiver
 * taps into a live session.
 */
export function warmUpPoseLandmarker(): void {
  getPoseLandmarker().catch((err) => {
    console.error("Failed to warm up PoseLandmarker:", err);
  });
}

export function detectPoseForVideo(
  landmarker: PoseLandmarker,
  video: HTMLVideoElement,
  timestampMs: number,
): PoseLandmarkerResult {
  return landmarker.detectForVideo(video, timestampMs);
}
