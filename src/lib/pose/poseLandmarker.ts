// src/lib/pose/poseLandmarker.ts
// Singleton loader — model initializes ONCE and is reused across camera sessions.
// This alone fixes most of the "slow to open" issue.

import {
  FilesetResolver,
  PoseLandmarker,
  type PoseLandmarkerResult,
} from "@mediapipe/tasks-vision";

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
    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
    );

    const landmarker = await PoseLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath:
          "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
        delegate: "GPU", // config change, not a model change — significant speed gain
      },
      runningMode: "VIDEO", // required for correct real-time tracking
      numPoses: 1,
      minPoseDetectionConfidence: 0.5,
      minPosePresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    poseLandmarkerInstance = landmarker;
    return landmarker;
  })();

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
  timestampMs: number
): PoseLandmarkerResult {
  return landmarker.detectForVideo(video, timestampMs);
}
