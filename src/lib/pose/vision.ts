// Shared MediaPipe WASM runtime. Resolved ONCE and used by both the pose and
// hand landmarkers so the runtime is never downloaded/initialised twice.
// Version matches the installed @mediapipe/tasks-vision (package.json).
import { FilesetResolver } from "@mediapipe/tasks-vision";

export const WASM_BASE = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm";

let visionPromise: ReturnType<typeof FilesetResolver.forVisionTasks> | null = null;

export function getVision() {
  if (!visionPromise) {
    visionPromise = FilesetResolver.forVisionTasks(WASM_BASE).catch((err) => {
      visionPromise = null; // allow retry after a network blip
      throw err;
    });
  }
  return visionPromise;
}
