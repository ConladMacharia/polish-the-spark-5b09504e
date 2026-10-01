// Singleton MediaPipe HandLandmarker — loaded once, reused across child games.
//
// Startup speed rules that matter here:
//  * the WASM fileset resolves ONCE and is shared by both variants
//  * the model file is fetched once and reused as a byte buffer, so the
//    two-hand variant never re-downloads it
//  * GPU is tried first, with an automatic CPU fallback so a device without a
//    working WebGL delegate still starts instead of hanging
import { HandLandmarker, type HandLandmarkerResult } from "@mediapipe/tasks-vision";
import { openCameraStream } from "@/lib/camera";
import { getVision } from "@/lib/pose/vision";

const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

let modelPromise: Promise<Uint8Array> | null = null;
function getModelBuffer() {
  if (!modelPromise) {
    modelPromise = fetch(MODEL_URL)
      .then((r) => {
        if (!r.ok) throw new Error(`Hand model download failed (${r.status})`);
        return r.arrayBuffer();
      })
      .then((b) => new Uint8Array(b))
      .catch((err) => {
        modelPromise = null; // allow retry
        throw err;
      });
  }
  return modelPromise;
}

async function create(numHands: number): Promise<HandLandmarker> {
  // WASM + model download run concurrently instead of one after the other.
  const [vision, modelAssetBuffer] = await Promise.all([getVision(), getModelBuffer()]);
  const options = (delegate: "GPU" | "CPU") => ({
    baseOptions: { modelAssetBuffer, delegate },
    runningMode: "VIDEO" as const,
    numHands,
    // Low thresholds = the hand locks on within the first frames instead of
    // needing a perfectly lit, perfectly still hand first. Lowered a touch more
    // for dim rooms, where detector scores sag even on a clearly visible hand.
    minHandDetectionConfidence: 0.3,
    minHandPresenceConfidence: 0.3,
    minTrackingConfidence: 0.3,
  });
  try {
    return await HandLandmarker.createFromOptions(vision, options("GPU"));
  } catch (err) {
    console.warn("HandLandmarker GPU delegate unavailable, falling back to CPU", err);
    return await HandLandmarker.createFromOptions(vision, options("CPU"));
  }
}

let instance: HandLandmarker | null = null;
let loading: Promise<HandLandmarker> | null = null;

export async function getHandLandmarker(): Promise<HandLandmarker> {
  if (instance) return instance;
  if (!loading) {
    loading = create(1).then((l) => {
      instance = l;
      return l;
    });
  }
  return loading;
}

// Two-hand variant: only for games that genuinely need both hands at once
// (e.g. bow-and-arrow aiming), kept separate so single-hand games stay fast.
let twoInstance: HandLandmarker | null = null;
let twoLoading: Promise<HandLandmarker> | null = null;

export async function getTwoHandLandmarker(): Promise<HandLandmarker> {
  if (twoInstance) return twoInstance;
  if (!twoLoading) {
    twoLoading = create(2).then((l) => {
      twoInstance = l;
      return l;
    });
  }
  return twoLoading;
}

/**
 * Fire-and-forget preload. Call this as soon as the child sees the game menu so
 * the WASM runtime and model are already in memory by the time a game opens.
 */
export function warmUpHandLandmarker(): void {
  getVision().catch(() => {});
  getModelBuffer().catch(() => {});
  getHandLandmarker().catch((err) => console.error("HandLandmarker warm-up failed", err));
}

/**
 * Low-latency, low-light-tuned camera stream shared by every camera game.
 * Re-uses a warm camera when one was just closed (see lib/camera.ts).
 */
export async function startCameraStream(): Promise<MediaStream> {
  return openCameraStream({ width: 640, height: 480, facingMode: "user" });
}

/**
 * Attaches a stream to a video element and resolves once real frames are
 * flowing, so the first detect() call never runs against an empty texture.
 */
export async function attachStream(video: HTMLVideoElement, stream: MediaStream): Promise<void> {
  video.srcObject = stream;
  video.muted = true;
  video.playsInline = true;
  try {
    await video.play();
  } catch {
    /* autoplay guard — frames still arrive once the element is visible */
  }
  if (video.readyState >= 2) return;
  await new Promise<void>((resolve) => {
    const done = () => resolve();
    video.addEventListener("loadeddata", done, { once: true });
    setTimeout(done, 1500);
  });
}

export type { HandLandmarkerResult };
