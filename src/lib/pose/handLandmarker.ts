// Singleton MediaPipe HandLandmarker — loaded once, reused across child games.
//
// Startup speed rules that matter here:
//  * the WASM fileset resolves ONCE and is shared by both variants
//  * the model file is fetched once and reused as a byte buffer, so the
//    two-hand variant never re-downloads it
//  * GPU is tried first, with an automatic CPU fallback so a device without a
//    working WebGL delegate still starts instead of hanging
import {
  FilesetResolver,
  HandLandmarker,
  type HandLandmarkerResult,
} from "@mediapipe/tasks-vision";

const WASM_BASE = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

let visionPromise: ReturnType<typeof FilesetResolver.forVisionTasks> | null = null;
function getVision() {
  if (!visionPromise) visionPromise = FilesetResolver.forVisionTasks(WASM_BASE);
  return visionPromise;
}

let modelPromise: Promise<Uint8Array> | null = null;
function getModelBuffer() {
  if (!modelPromise) {
    modelPromise = fetch(MODEL_URL)
      .then((r) => r.arrayBuffer())
      .then((b) => new Uint8Array(b));
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
    // needing a perfectly lit, perfectly still hand first.
    minHandDetectionConfidence: 0.35,
    minHandPresenceConfidence: 0.35,
    minTrackingConfidence: 0.35,
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
 * Drops the cached one-hand landmarker so the next getHandLandmarker() builds a
 * fresh one. Used by the stall watchdog when detection dies mid-game.
 */
export function resetHandLandmarker(): void {
  try {
    instance?.close();
  } catch {
    /* already gone */
  }
  instance = null;
  loading = null;
}

/** Same, for the two-hand variant. */
export function resetTwoHandLandmarker(): void {
  try {
    twoInstance?.close();
  } catch {
    /* already gone */
  }
  twoInstance = null;
  twoLoading = null;
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
 * Low-latency camera stream shared by every camera game.
 *
 * Some devices reject the ideal constraints outright (locked frame rate, no
 * front camera, virtual cameras), so we walk down to plainer requests instead
 * of failing the whole game on the first rejection.
 */
export async function startCameraStream(): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("no-camera-api");
  }
  const attempts: MediaStreamConstraints[] = [
    {
      video: {
        width: { ideal: 640 },
        height: { ideal: 480 },
        frameRate: { ideal: 30, max: 30 },
        facingMode: "user",
      },
      audio: false,
    },
    { video: { facingMode: "user" }, audio: false },
    { video: true, audio: false },
  ];
  let lastErr: unknown;
  for (const constraints of attempts) {
    try {
      return await navigator.mediaDevices.getUserMedia(constraints);
    } catch (err) {
      lastErr = err;
      // A denied permission will never succeed with looser constraints.
      const name = (err as { name?: string })?.name;
      if (name === "NotAllowedError" || name === "SecurityError") break;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("camera-failed");
}

/** Child-friendly explanation for a camera / tracking start-up failure. */
export function describeCameraError(err: unknown): string {
  const name = (err as { name?: string })?.name;
  const msg = (err as { message?: string })?.message ?? "";
  if (name === "NotAllowedError" || name === "SecurityError")
    return "Rafiki needs the camera. Allow camera access in your browser, then try again.";
  if (name === "NotFoundError" || name === "OverconstrainedError")
    return "No camera was found on this device. Plug one in or switch devices, then try again.";
  if (name === "NotReadableError" || name === "AbortError")
    return "The camera is being used by another app. Close it, then try again.";
  if (msg === "no-camera-api")
    return "This browser can't use the camera. Try Chrome or Safari on a secure (https) link.";
  return "Hand tracking couldn't start. Check your connection and try again.";
}


/**
 * Attaches a stream to a video element and resolves once real frames are
 * flowing, so the first detect() call never runs against an empty texture.
 */
export async function attachStream(
  video: HTMLVideoElement,
  stream: MediaStream
): Promise<void> {
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
