// src/lib/camera.ts
// Fast camera opening + low-light handling, shared by every camera screen.
//
// FAST OPEN
//  * One tuned constraint set, with a graceful fallback ladder so an
//    "overconstrained" device still opens instead of failing.
//  * A short-lived warm stream: leaving one game and entering another (or
//    re-opening an exercise) re-uses the already-running camera instead of
//    paying the ~0.5-1.5s device start-up again. Callers keep using the normal
//    `stream.getTracks().forEach(t => t.stop())` — no call-site changes needed.
//
// LOW LIGHT
//  * Turns on continuous auto-exposure / white-balance / focus and nudges
//    exposure compensation up where the camera supports it.
//  * Allows the camera to drop to 15fps (frameRate `min`) so the driver can use
//    a longer exposure instead of a noisy, dark 30fps picture.
//  * LowLightBooster measures scene brightness and, only when it is dark,
//    feeds the model a gamma-lifted copy of the frame (and brightens the
//    on-screen video) so landmarks lock on in dim rooms.

const WARM_IDLE_MS = 5000; // how long the camera stays warm after the last user leaves

/* ── STREAM OPENING ─────────────────────────────────────────────────────── */

export interface CameraOptions {
  width?: number;
  height?: number;
  facingMode?: "user" | "environment";
}

let master: MediaStream | null = null;
let masterPromise: Promise<MediaStream> | null = null;
let activeClones = 0;
let idleTimer: ReturnType<typeof setTimeout> | null = null;
let visibilityHooked = false;

function stopMaster() {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = null;
  master?.getTracks().forEach((t) => t.stop());
  master = null;
  masterPromise = null;
}

function hookVisibility() {
  if (visibilityHooked || typeof document === "undefined") return;
  visibilityHooked = true;
  // Never hold the camera while the tab is in the background.
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && activeClones === 0) stopMaster();
  });
}

function masterIsLive(): boolean {
  return !!master && master.getVideoTracks().some((t) => t.readyState === "live");
}

async function acquire(opts: CameraOptions): Promise<MediaStream> {
  const width = opts.width ?? 640;
  const height = opts.height ?? 480;
  const facingMode = opts.facingMode ?? "user";

  const ladder: MediaStreamConstraints[] = [
    {
      video: {
        facingMode,
        width: { ideal: width },
        height: { ideal: height },
        // min 15 lets the camera lengthen exposure in the dark instead of
        // forcing a grainy 30fps image.
        frameRate: { ideal: 30, min: 15 },
      },
      audio: false,
    },
    { video: { facingMode, width: { ideal: width }, height: { ideal: height } }, audio: false },
    { video: true, audio: false },
  ];

  let lastErr: unknown;
  for (const constraints of ladder) {
    try {
      return await navigator.mediaDevices.getUserMedia(constraints);
    } catch (err) {
      lastErr = err;
      const name = (err as DOMException)?.name;
      // Permission / hardware problems won't be fixed by looser constraints.
      if (name === "NotAllowedError" || name === "SecurityError" || name === "NotFoundError") {
        throw err;
      }
    }
  }
  throw lastErr;
}

/** Best-effort camera tuning for dim rooms. Never throws, never blocks. */
function tuneForLowLight(track: MediaStreamTrack) {
  try {
    const caps = (track.getCapabilities?.() ?? {}) as Record<string, any>;
    const adv: Record<string, unknown> = {};
    const has = (key: string, v: string) => Array.isArray(caps[key]) && caps[key].includes(v);

    if (has("exposureMode", "continuous")) adv.exposureMode = "continuous";
    if (has("whiteBalanceMode", "continuous")) adv.whiteBalanceMode = "continuous";
    if (has("focusMode", "continuous")) adv.focusMode = "continuous";

    const ec = caps.exposureCompensation;
    if (ec && typeof ec.max === "number") {
      // Lean towards brighter, but not so far that bright rooms blow out.
      adv.exposureCompensation = Math.min(ec.max, Math.max(ec.min ?? 0, ec.max * 0.6));
    }

    if (Object.keys(adv).length > 0) {
      track.applyConstraints({ advanced: [adv as MediaTrackConstraintSet] }).catch(() => {});
    }
  } catch {
    /* unsupported on this browser/device — ignore */
  }
}

/**
 * Opens the camera. Returns a stream whose tracks can be stopped normally; the
 * underlying device is kept warm for a few seconds so the next open is instant.
 */
export async function openCameraStream(opts: CameraOptions = {}): Promise<MediaStream> {
  hookVisibility();
  if (idleTimer) {
    clearTimeout(idleTimer);
    idleTimer = null;
  }

  if (!masterIsLive()) {
    master = null;
    masterPromise = null;
  }
  if (!masterPromise) {
    masterPromise = acquire(opts)
      .then((s) => {
        master = s;
        s.getVideoTracks().forEach(tuneForLowLight);
        return s;
      })
      .catch((err) => {
        masterPromise = null;
        throw err;
      });
  }
  const base = await masterPromise;

  // Hand out a clone: stopping it does not stop the shared device.
  const clone = base.clone();
  activeClones += 1;
  let released = 0;
  const tracks = clone.getTracks();
  const releaseOne = () => {
    released += 1;
    if (released < tracks.length) return;
    activeClones = Math.max(0, activeClones - 1);
    if (activeClones === 0) {
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(stopMaster, WARM_IDLE_MS);
    }
  };
  tracks.forEach((track) => {
    const originalStop = track.stop.bind(track);
    let done = false;
    track.stop = () => {
      originalStop();
      if (!done) {
        done = true;
        releaseOne();
      }
    };
  });
  return clone;
}

/**
 * Optional: call when a screen with a camera is likely coming next. It only
 * warms an already-permitted camera — it never triggers a permission prompt.
 */
export async function warmUpCamera(): Promise<void> {
  try {
    const status = await (navigator.permissions as Permissions | undefined)?.query({
      name: "camera" as PermissionName,
    });
    if (status?.state !== "granted") return;
    const s = await openCameraStream();
    s.getTracks().forEach((t) => t.stop()); // releases our lease; device stays warm briefly
  } catch {
    /* ignore */
  }
}

/* ── LOW-LIGHT BOOSTER ──────────────────────────────────────────────────── */

export interface LowLightOptions {
  /** Mean luma (0..1) below which boosting switches on. */
  enableBelow?: number;
  /** Mean luma (0..1) above which boosting switches off (hysteresis). */
  disableAbove?: number;
  /** Luma the booster aims for once active. */
  target?: number;
  /** Cap on the gamma lift so noise isn't amplified into mush. */
  maxGain?: number;
}

/**
 * Usage (per camera screen):
 *   const booster = useRef(new LowLightBooster()).current;
 *   const result = landmarker.detectForVideo(booster.frame(video), now);
 *
 * `frame()` returns the raw <video> in normal light (zero overhead) and a
 * brightened canvas in the dark. Landmarks are normalized 0..1, so they map
 * straight back onto the real video.
 */
export class LowLightBooster {
  private probe: HTMLCanvasElement | null = null;
  private probeCtx: CanvasRenderingContext2D | null = null;
  private work: HTMLCanvasElement | null = null;
  private workCtx: CanvasRenderingContext2D | null = null;
  private lut = new Uint8ClampedArray(256);
  private lutGain = 0;
  private lastProbeAt = 0;
  private active = false;
  private gain = 1;
  private readonly o: Required<LowLightOptions>;

  constructor(options: LowLightOptions = {}) {
    this.o = { enableBelow: 0.3, disableAbove: 0.38, target: 0.45, maxGain: 2.6, ...options };
  }

  /** True while the booster is lifting the image. */
  get isBoosting() {
    return this.active;
  }

  frame(video: HTMLVideoElement): HTMLVideoElement | HTMLCanvasElement {
    if (typeof document === "undefined" || video.readyState < 2) return video;

    const now = performance.now();
    if (now - this.lastProbeAt > 400) {
      this.lastProbeAt = now;
      this.measure(video);
    }
    if (!this.active) return video;
    return this.enhance(video) ?? video;
  }

  reset() {
    this.active = false;
    this.gain = 1;
  }

  private measure(video: HTMLVideoElement) {
    if (!this.probe) {
      this.probe = document.createElement("canvas");
      this.probe.width = 32;
      this.probe.height = 24;
      this.probeCtx = this.probe.getContext("2d", { willReadFrequently: true });
    }
    const ctx = this.probeCtx;
    if (!ctx) return;
    try {
      ctx.drawImage(video, 0, 0, 32, 24);
      const d = ctx.getImageData(0, 0, 32, 24).data;
      let sum = 0;
      for (let i = 0; i < d.length; i += 4) {
        sum += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
      }
      const mean = sum / (d.length / 4) / 255;

      if (!this.active && mean < this.o.enableBelow) this.active = true;
      else if (this.active && mean > this.o.disableAbove) this.active = false;

      // Gamma that would bring this scene to the target brightness.
      const wanted = this.active
        ? Math.min(
            this.o.maxGain,
            Math.max(1, Math.log(this.o.target) / Math.log(Math.max(mean, 0.02))),
          )
        : 1;
      this.gain += (wanted - this.gain) * 0.5; // smooth: no visible pumping
      this.styleVideo(video);
    } catch {
      /* cross-origin / not ready — skip this probe */
    }
  }

  /** Brighten what the person sees too, so dark rooms aren't a black box. */
  private styleVideo(video: HTMLVideoElement) {
    video.style.filter = this.active
      ? `brightness(${(1 + (this.gain - 1) * 0.55).toFixed(2)}) contrast(1.08)`
      : "";
  }

  private enhance(video: HTMLVideoElement): HTMLCanvasElement | null {
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!vw || !vh) return null;

    // Models resize to ~200-256px internally, so a small working canvas is
    // plenty and keeps the per-frame cost to ~1-2ms.
    const w = 384;
    const h = Math.max(2, Math.round((w * vh) / vw));
    if (!this.work) {
      this.work = document.createElement("canvas");
      this.workCtx = this.work.getContext("2d", { willReadFrequently: true });
    }
    const ctx = this.workCtx;
    if (!ctx || !this.work) return null;
    if (this.work.width !== w || this.work.height !== h) {
      this.work.width = w;
      this.work.height = h;
    }

    // Rebuild the gamma lookup table only when the gain has moved noticeably.
    if (Math.abs(this.gain - this.lutGain) > 0.03) {
      this.lutGain = this.gain;
      const inv = 1 / this.gain;
      for (let i = 0; i < 256; i++) this.lut[i] = Math.round(255 * Math.pow(i / 255, inv));
    }

    try {
      ctx.drawImage(video, 0, 0, w, h);
      const img = ctx.getImageData(0, 0, w, h);
      const d = img.data;
      const lut = this.lut;
      for (let i = 0; i < d.length; i += 4) {
        d[i] = lut[d[i]];
        d[i + 1] = lut[d[i + 1]];
        d[i + 2] = lut[d[i + 2]];
      }
      ctx.putImageData(img, 0, 0);
      return this.work;
    } catch {
      return null;
    }
  }
}
