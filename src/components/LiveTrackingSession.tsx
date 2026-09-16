// src/components/LiveTrackingSession.tsx
// Phase 1 (smooth tracking) + Phase 2 (live angle calculation + recording) combined.
// No voice feedback, rep counting, or thresholds yet — display + recording only.

import { useEffect, useRef, useState } from "react";
import { DrawingUtils, PoseLandmarker } from "@mediapipe/tasks-vision";
import { getPoseLandmarker } from "@/lib/pose/poseLandmarker";
import {
  getElbowAngle,
  getShoulderFlexionAngle,
  LandmarkSmoother,
  AngleRecorder,
  type Point2D,
  type Side,
} from "@/lib/pose/angleUtils";
import { saveTrackedSession } from "@/lib/sessions.data";

type TrackedMovement = "elbow" | "shoulderFlexion";

interface LiveTrackingSessionProps {
  movement: TrackedMovement;
  side?: Side;
  /** Optional: patient id (from patients.id) to save session results */
  childId?: string;
  /** Optional: exercise slug to annotate saved session */
  exerciseSlug?: string;
  /** Optional: therapist-set target overrides (accepted for API compatibility) */
  overrides?: unknown[];
}

// Downscaled processing resolution — the model runs on this size regardless
// of the actual camera/display resolution. Big speed win, negligible accuracy loss.
const PROCESS_WIDTH = 640;
const PROCESS_HEIGHT = 480;

export function LiveTrackingSession({
  movement,
  side = "right",
  childId,
  exerciseSlug,
  overrides = [],
}: LiveTrackingSessionProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const landmarkerRef = useRef<PoseLandmarker | null>(null);
  const smoothersRef = useRef<Map<number, LandmarkSmoother>>(new Map());
  const recorderRef = useRef(new AngleRecorder());
  const animationFrameRef = useRef<number | null>(null);
  const isDetectingRef = useRef(false); // guard against overlapping detections
  const lastVideoTimeRef = useRef(-1);

  const [liveAngle, setLiveAngle] = useState<number | null>(null);
  const [maxAngle, setMaxAngle] = useState<number | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [statusMessage, setStatusMessage] = useState("Starting camera...");

  function exerciseEnum(slug?: string) {
    if (!slug) return "arm_raise" as const;
    if (slug === "gait") return "gait" as const;
    if (["balance", "head", "stretch", "ball-throw"].includes(slug)) return "balance_hold" as const;
    if (
      [
        "prone",
        "rolling",
        "kneeling",
        "half-kneel",
        "wall-stand",
        "horse",
        "breathing",
      ].includes(slug)
    )
      return "postural_control" as const;
    if (
      [
        "leg",
        "march",
        "squat",
        "sitstand",
        "bridge",
        "ankle",
        "crawl",
        "heel-raise",
        "step-up",
        "obstacle",
        "aquatic",
      ].includes(slug)
    )
      return "leg_kick" as const;
    if (["arm", "reach", "shoulder", "trunk", "sidelying", "pnf"].includes(slug)) return "arm_raise" as const;
    return "arm_raise" as const;
  }

  async function saveSession() {
    const history = recorderRef.current.getHistory();
    if (!history || history.length === 0) {
      console.warn("No recorded samples — skipping save");
      return;
    }
    await saveTrackedSession({
      history: history as { t: number; angle: number }[],
      exerciseSlug: exerciseSlug ?? (movement === "elbow" ? "bend-and-straighten" : "forward-reach"),
      side,
      patientId: childId ?? null,
    });
    recorderRef.current.reset();
    setMaxAngle(null);
  }

  useEffect(() => {
    let stream: MediaStream | null = null;

    async function setup() {
      // Model should already be warmed up from app mount (see poseLandmarker.ts),
      // so this typically resolves instantly rather than triggering a fresh load.
      setStatusMessage("Loading tracking model...");
      landmarkerRef.current = await getPoseLandmarker();

      setStatusMessage("Requesting camera access...");
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: PROCESS_WIDTH },
          height: { ideal: PROCESS_HEIGHT },
          facingMode: "user",
        },
        audio: false,
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setIsReady(true);
      setStatusMessage("");
      requestAnimationFrame(detectionLoop);
    }

    setup().catch((err) => {
      console.error("Setup failed:", err);
      setStatusMessage("Camera or tracking failed to start. Please try again.");
    });

    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      stream?.getTracks().forEach((track) => track.stop());
      recorderRef.current.reset();
      smoothersRef.current.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function detectionLoop() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const landmarker = landmarkerRef.current;

    if (!video || !canvas || !landmarker) {
      animationFrameRef.current = requestAnimationFrame(detectionLoop);
      return;
    }

    // Skip if we're still processing the previous frame — prevents
    // frames from queuing up and the lag you saw earlier.
    if (isDetectingRef.current || video.currentTime === lastVideoTimeRef.current) {
      animationFrameRef.current = requestAnimationFrame(detectionLoop);
      return;
    }

    isDetectingRef.current = true;
    lastVideoTimeRef.current = video.currentTime;

    const timestampMs = performance.now();
    const result = landmarker.detectForVideo(video, timestampMs);

    const ctx = canvas.getContext("2d");
    if (ctx && result.landmarks.length > 0) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const rawLandmarks = result.landmarks[0];

      // Apply EMA smoothing per landmark point before using/drawing them
      const smoothedLandmarks: Point2D[] = rawLandmarks.map((lm, i) => {
        if (!smoothersRef.current.has(i)) {
          smoothersRef.current.set(i, new LandmarkSmoother(0.3));
        }
        const smoother = smoothersRef.current.get(i)!;
        return smoother.update({ x: lm.x * canvas.width, y: lm.y * canvas.height });
      });

      // Draw skeleton overlay using smoothed points
      const drawingUtils = new DrawingUtils(ctx);
      const normalizedForDrawing = smoothedLandmarks.map((p) => ({
        x: p.x / canvas.width,
        y: p.y / canvas.height,
        z: 0,
        visibility: 1,
      }));
      drawingUtils.drawLandmarks(normalizedForDrawing, { radius: 4 });
      drawingUtils.drawConnectors(
        normalizedForDrawing,
        PoseLandmarker.POSE_CONNECTIONS
      );

      // Calculate the requested angle from the smoothed landmarks
      let angle: number;
      if (movement === "elbow") {
        angle = getElbowAngle(smoothedLandmarks, side);
      } else {
        angle = getShoulderFlexionAngle(smoothedLandmarks, side);
      }

      setLiveAngle(Math.round(angle));
      recorderRef.current.record(angle);
      setMaxAngle(
        recorderRef.current.getMax() !== null
          ? Math.round(recorderRef.current.getMax()!)
          : null
      );
    }

    isDetectingRef.current = false;
    animationFrameRef.current = requestAnimationFrame(detectionLoop);
  }

  function resetRecording() {
    recorderRef.current.reset();
    setMaxAngle(null);
  }

  return (
    <div style={{ position: "relative", width: "100%", maxWidth: 640 }}>
      <video
        ref={videoRef}
        style={{ width: "100%", transform: "scaleX(-1)", display: "block" }}
        playsInline
        muted
      />
      <canvas
        ref={canvasRef}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          transform: "scaleX(-1)",
        }}
      />

      {!isReady && (
        <div style={{ padding: 16, textAlign: "center" }}>{statusMessage}</div>
      )}

      {isReady && (
        <div style={{ marginTop: 12, padding: 12, textAlign: "center" }}>
          <div style={{ fontSize: 14, opacity: 0.7 }}>
            Tracking: {movement === "elbow" ? "Elbow" : "Shoulder"} ({side})
          </div>
          <div style={{ fontSize: 32, fontWeight: 700 }}>
            {liveAngle !== null ? `${liveAngle}°` : "—"}
          </div>
          <div style={{ fontSize: 14, opacity: 0.7, marginTop: 4 }}>
            Best this session:{" "}
            {maxAngle !== null ? `${maxAngle}°` : "Not yet recorded"}
          </div>
          <button onClick={resetRecording} style={{ marginTop: 8 }}>
            Reset recording
          </button>
          <div style={{ marginTop: 12 }}>
            <button onClick={saveSession} style={{ marginRight: 8 }}>
              Finish session & save
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
