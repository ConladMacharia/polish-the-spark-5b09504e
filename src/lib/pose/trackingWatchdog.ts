// Automatic recovery for hand tracking.
//
// MediaPipe occasionally stops returning landmarks mid-game (GPU context loss,
// a backgrounded tab, or a camera track that quietly ends). Nothing throws — the
// game just goes dead. This watchdog notices that and rebuilds the landmarker,
// and the camera stream too when the video element stopped producing frames.

import {
  attachStream,
  resetHandLandmarker,
  resetTwoHandLandmarker,
  getHandLandmarker,
  getTwoHandLandmarker,
  startCameraStream,
} from "./handLandmarker";
import type { HandLandmarker } from "@mediapipe/tasks-vision";

interface WatchdogOptions {
  /** No landmarks for this long while the game runs → rebuild. */
  stallMs?: number;
  /** Minimum spacing between two recovery attempts. */
  cooldownMs?: number;
  /** Games needing both hands (Balloon Fair) use the two-hand variant. */
  twoHands?: boolean;
  video: () => HTMLVideoElement | null;
  /** Receives the freshly created landmarker. */
  onLandmarker: (landmarker: HandLandmarker) => void;
  /** Receives a freshly acquired camera stream, when one was needed. */
  onStream?: (stream: MediaStream) => void;
  onStatus?: (message: string | null) => void;
}

export class TrackingWatchdog {
  private stallMs: number;
  private cooldownMs: number;
  private lastDetection = 0;
  private lastAttempt = 0;
  private recovering = false;
  private disposed = false;
  private opts: WatchdogOptions;

  constructor(opts: WatchdogOptions) {
    this.opts = opts;
    this.stallMs = opts.stallMs ?? 4000;
    this.cooldownMs = opts.cooldownMs ?? 6000;
  }

  /** Call once tracking has started, and on every successful detection. */
  markDetection(now = performance.now()) {
    this.lastDetection = now;
  }

  /** Call every animation frame; triggers recovery when detection has stalled. */
  markFrame(now = performance.now()) {
    if (this.disposed || this.recovering) return;
    if (this.lastDetection === 0) {
      // grace period until the first detection ever arrives
      this.lastDetection = now;
      return;
    }
    if (document.visibilityState === "hidden") {
      this.lastDetection = now;
      return;
    }
    if (now - this.lastDetection < this.stallMs) return;
    if (now - this.lastAttempt < this.cooldownMs) return;
    this.lastAttempt = now;
    void this.recover();
  }

  private async recover() {
    this.recovering = true;
    this.opts.onStatus?.("Reconnecting hand tracking...");
    try {
      const video = this.opts.video();

      // A camera track that ended or a video element with no frames means the
      // stream itself has to come back before a new landmarker helps.
      const stream = video?.srcObject as MediaStream | null;
      const trackDead =
        !stream || stream.getVideoTracks().every((t) => t.readyState === "ended");
      if (video && (trackDead || video.readyState < 2 || video.paused)) {
        const fresh = trackDead ? await startCameraStream() : stream!;
        if (trackDead) {
          stream?.getTracks().forEach((t) => t.stop());
          this.opts.onStream?.(fresh);
        }
        await attachStream(video, fresh);
      }

      if (this.opts.twoHands) {
        resetTwoHandLandmarker();
        this.opts.onLandmarker(await getTwoHandLandmarker());
      } else {
        resetHandLandmarker();
        this.opts.onLandmarker(await getHandLandmarker());
      }
      this.lastDetection = performance.now();
      this.opts.onStatus?.(null);
    } catch (err) {
      console.error("Hand tracking recovery failed", err);
      this.opts.onStatus?.(null);
    } finally {
      this.recovering = false;
    }
  }

  dispose() {
    this.disposed = true;
  }
}
