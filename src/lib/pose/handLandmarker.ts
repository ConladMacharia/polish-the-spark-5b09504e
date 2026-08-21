// Singleton MediaPipe HandLandmarker — loaded once, reused across child games.
import {
  FilesetResolver,
  HandLandmarker,
  type HandLandmarkerResult,
} from "@mediapipe/tasks-vision";

let instance: HandLandmarker | null = null;
let loading: Promise<HandLandmarker> | null = null;

export async function getHandLandmarker(): Promise<HandLandmarker> {
  if (instance) return instance;
  if (loading) return loading;

  loading = (async () => {
    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
    );
    // One hand only: halves per-frame inference cost, which is the single
    // biggest source of perceived tracking lag in the camera games.
    const landmarker = await HandLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath:
          "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
        delegate: "GPU",
      },
      runningMode: "VIDEO",
      numHands: 1,
      minHandDetectionConfidence: 0.4,
      minHandPresenceConfidence: 0.4,
      minTrackingConfidence: 0.4,
    });
    instance = landmarker;
    return landmarker;
  })();

  return loading;
}

export function warmUpHandLandmarker(): void {
  getHandLandmarker().catch((err) => console.error("HandLandmarker warm-up failed", err));
}

export type { HandLandmarkerResult };
