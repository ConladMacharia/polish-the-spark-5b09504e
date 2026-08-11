import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";

const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";
const WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";

let cached: Promise<PoseLandmarker> | null = null;

async function create(delegate: "GPU" | "CPU") {
  const vision = await FilesetResolver.forVisionTasks(WASM_URL);
  return PoseLandmarker.createFromOptions(vision, {
    baseOptions: { modelAssetPath: MODEL_URL, delegate },
    runningMode: "VIDEO",
    numPoses: 1,
  });
}

/**
 * Loads the lite pose model once per page session (GPU delegate, CPU fallback).
 * Safe to call repeatedly — the same instance/promise is reused.
 */
export function getPoseLandmarker(): Promise<PoseLandmarker> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("PoseLandmarker is browser-only"));
  }
  if (!cached) {
    cached = create("GPU").catch(async (err) => {
      console.warn("GPU delegate unavailable, falling back to CPU:", err);
      return create("CPU");
    });
    cached.catch(() => {
      cached = null;
    });
  }
  return cached;
}
