// src/components/PianoGroveGame.tsx
// Camera-tracked version of Piano Grove. Replaces tap input with real
// thumb-to-finger touch detection. Includes a live debug panel showing
// all 4 raw distances — this is the actual accuracy test, not just the game.

import { useEffect, useRef, useState } from "react";
import type { HandLandmarker } from "@mediapipe/tasks-vision";
import { getHandLandmarker, startCameraStream, attachStream } from "@/lib/pose/handLandmarker";
import { getFingerDistances, getActiveFinger, TOUCH_THRESHOLD, type FingerName } from "@/lib/pose/fingerUtils";
import {
  handConfidence,
  blendConfidence,
  JitterMonitor,
  tolerantThreshold,
  AdaptiveScalar,
  AdaptivePinch,
} from "@/lib/pose/adaptiveTracking";

// Finger skeleton connections (MediaPipe hand model) for the live overlay.
const HAND_BONES: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17],
];
const TIP_INDEX: Record<FingerName, number> = { index: 8, middle: 12, ring: 16, pinky: 20 };


const FINGER_ORDER: FingerName[] = ["index", "middle", "ring", "pinky"];
const FINGER_COLOR: Record<FingerName, string> = {
  index: "#E8A24B",
  middle: "#6FB58A",
  ring: "#6E9BD1",
  pinky: "#C87DAE",
};
// Each finger gets its own short motif + timbre so taps sound clearly distinct.
const NOTE_MOTIF: Record<FingerName, { freqs: number[]; type: OscillatorType }> = {
  index: { freqs: [523.25, 659.25, 783.99], type: "sine" }, // C major arpeggio
  middle: { freqs: [587.33, 698.46, 880.0], type: "triangle" }, // D minor-ish
  ring: { freqs: [659.25, 783.99, 987.77], type: "square" }, // E
  pinky: { freqs: [698.46, 880.0, 1046.5], type: "sawtooth" }, // F
};

const TRAVEL_MS = 2400;
const SPAWN_GAP_MS = 1100;
const SONG_LENGTH = 12;

interface NoteState {
  id: number;
  finger: FingerName;
  progress: number;
  hit: boolean;
}

export function PianoGroveGame({ onExit }: { onExit?: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const landmarkerRef = useRef<HandLandmarker | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const gameFrameRef = useRef<number | null>(null);
  const cancelledRef = useRef(false);
  const isDetectingRef = useRef(false);
  const lastVideoTimeRef = useRef(-1);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const jitterRef = useRef(new JitterMonitor());
  const lastUiUpdateRef = useRef(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Per-finger smoothing + hysteresis: a smoothed distance stops jitter from
  // faking taps, and the pinch band stops a held touch from flickering.
  const smoothRef = useRef<Record<FingerName, AdaptiveScalar>>({
    index: new AdaptiveScalar(),
    middle: new AdaptiveScalar(),
    ring: new AdaptiveScalar(),
    pinky: new AdaptiveScalar(),
  });
  const pinchRef = useRef<Record<FingerName, AdaptivePinch>>({
    index: new AdaptivePinch({ closeAt: 0.32, releaseAt: 0.46, graceMs: 120 }),
    middle: new AdaptivePinch({ closeAt: 0.32, releaseAt: 0.46, graceMs: 120 }),
    ring: new AdaptivePinch({ closeAt: 0.34, releaseAt: 0.48, graceMs: 120 }),
    pinky: new AdaptivePinch({ closeAt: 0.36, releaseAt: 0.5, graceMs: 120 }),
  });


  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [liveDistances, setLiveDistances] = useState<Record<FingerName, number> | null>(null);
  const [activeFinger, setActiveFinger] = useState<FingerName | null>(null);
  const [notes, setNotes] = useState<NoteState[]>([]);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [feedback, setFeedback] = useState<{ text: string; color: string } | null>(null);

  const noteIdRef = useRef(0);
  const spawnedRef = useRef(0);
  const lastSpawnRef = useRef(0);
  const notesRef = useRef<NoteState[]>([]);
  const lastHitFrameRef = useRef<Record<FingerName, boolean>>({
    index: false,
    middle: false,
    ring: false,
    pinky: false,
  });

  useEffect(() => {
    notesRef.current = notes;
  }, [notes]);

  useEffect(() => {
    let stream: MediaStream | null = null;
    cancelledRef.current = false;

    async function setup() {
      // Camera prompt and model load start together: waiting for the model
      // first delayed the permission dialog by seconds.
      const [landmarker, camera] = await Promise.all([
        getHandLandmarker(),
        startCameraStream(),
      ]);
      stream = camera;
      if (cancelledRef.current) {
        camera.getTracks().forEach((t) => t.stop());
        return;
      }
      landmarkerRef.current = landmarker;
      if (videoRef.current) await attachStream(videoRef.current, camera);
      if (cancelledRef.current) return;
      setIsReady(true);
      animationFrameRef.current = requestAnimationFrame(detectionLoop);
      gameFrameRef.current = requestAnimationFrame(gameLoop);
    }

    setup().catch((err) => {
      console.error("Setup failed:", err);
      setError("Rafiki can't reach the camera. Allow camera access and try again.");
    });

    return () => {
      cancelledRef.current = true;
      if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current);
      if (gameFrameRef.current !== null) cancelAnimationFrame(gameFrameRef.current);
      stream?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function playTone(finger: FingerName) {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }
    const ctx = audioCtxRef.current;
    if (ctx.state === "suspended") void ctx.resume();
    const motif = NOTE_MOTIF[finger];
    const step = 0.11;
    motif.freqs.forEach((freq, i) => {
      const start = ctx.currentTime + i * step;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = motif.type;
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.16, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.32);
    });
  }

  function detectionLoop() {
    if (cancelledRef.current) return;
    const video = videoRef.current;
    const landmarker = landmarkerRef.current;

    if (!video || !landmarker) {
      animationFrameRef.current = requestAnimationFrame(detectionLoop);
      return;
    }

    if (isDetectingRef.current || video.currentTime === lastVideoTimeRef.current) {
      animationFrameRef.current = requestAnimationFrame(detectionLoop);
      return;
    }

    isDetectingRef.current = true;
    lastVideoTimeRef.current = video.currentTime;

    const result = landmarker.detectForVideo(video, performance.now());

    const nowMs = performance.now();

    if (result.landmarks.length > 0) {
      const lm = result.landmarks[0];
      const raw = getFingerDistances(lm);

      const stability = jitterRef.current.push({ x: lm[0].x, y: lm[0].y });
      const conf = blendConfidence(
        handConfidence(result),
        jitterRef.current.stability ?? stability
      );

      // Smooth each thumb→fingertip distance before judging a touch, so
      // landmark jitter can't fire phantom taps.
      const smooth = {
        index: smoothRef.current.index.push(raw.index, conf),
        middle: smoothRef.current.middle.push(raw.middle, conf),
        ring: smoothRef.current.ring.push(raw.ring, conf),
        pinky: smoothRef.current.pinky.push(raw.pinky, conf),
      } as Record<FingerName, number>;

      if (nowMs - lastUiUpdateRef.current > 120) {
        lastUiUpdateRef.current = nowMs;
        setLiveDistances(smooth);
      }

      // Which finger is the unambiguous candidate this frame…
      const candidate = getActiveFinger(
        smooth,
        tolerantThreshold(TOUCH_THRESHOLD, conf, 0.4)
      );

      // …then hysteresis decides engage/release per finger so a held touch
      // stays held and a released one doesn't retrigger on noise.
      let active: FingerName | null = null;
      for (const f of FINGER_ORDER) {
        const detector = pinchRef.current[f];
        const closed =
          f === candidate
            ? detector.update(smooth[f], conf, nowMs)
            : detector.markMissing(conf, nowMs);
        if (closed && (active === null || smooth[f] < smooth[active])) active = f;
      }
      setActiveFinger(active);

      if (active && !lastHitFrameRef.current[active]) {
        handleTouch(active);
      }
      const newHitState: Record<FingerName, boolean> = {
        index: false,
        middle: false,
        ring: false,
        pinky: false,
      };
      if (active) newHitState[active] = true;
      lastHitFrameRef.current = newHitState;

      drawHand(lm, active);
    } else {
      for (const f of FINGER_ORDER) pinchRef.current[f].markMissing(0.2, nowMs);
      setLiveDistances(null);
      setActiveFinger(null);
      drawHand(null, null);
    }


    isDetectingRef.current = false;
    animationFrameRef.current = requestAnimationFrame(detectionLoop);
  }

  // Mirrored finger overlay so the child can see exactly what is tracked.
  function drawHand(lm: { x: number; y: number }[] | null, active: FingerName | null) {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;
    const w = canvas.clientWidth || 320;
    const h = canvas.clientHeight || 180;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, w, h);
    if (!lm) return;

    const px = (i: number) => ({ x: (1 - lm[i].x) * w, y: lm[i].y * h });

    ctx.lineWidth = 2.5;
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    for (const [a, b] of HAND_BONES) {
      const p1 = px(a);
      const p2 = px(b);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }

    const thumb = px(4);
    for (const f of FINGER_ORDER) {
      const tip = px(TIP_INDEX[f]);
      ctx.fillStyle = FINGER_COLOR[f];
      ctx.beginPath();
      ctx.arc(tip.x, tip.y, active === f ? 10 : 6, 0, Math.PI * 2);
      ctx.fill();
      if (active === f) {
        ctx.strokeStyle = FINGER_COLOR[f];
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(thumb.x, thumb.y);
        ctx.lineTo(tip.x, tip.y);
        ctx.stroke();
      }
    }

    ctx.fillStyle = "#333";
    ctx.beginPath();
    ctx.arc(thumb.x, thumb.y, 8, 0, Math.PI * 2);
    ctx.fill();
  }



  function handleTouch(finger: FingerName) {
    // Every recognised thumb→finger touch sounds its own motif/timbre, whether
    // or not a note is in the hit window. The finger IS the instrument.
    playTone(finger);

    const candidates = notesRef.current.filter((n) => n.finger === finger && !n.hit);
    if (candidates.length === 0) return;

    const closest = candidates.reduce((a, b) =>
      Math.abs(a.progress - 1) < Math.abs(b.progress - 1) ? a : b
    );

    const distFromTarget = Math.abs(closest.progress - 1);
    if (distFromTarget > 0.25) return;

    closest.hit = true;

    const quality = distFromTarget < 0.08 ? "great" : "good";
    setFeedback({
      text: quality === "great" ? "great!" : "good",
      color: quality === "great" ? "#6FB58A" : "#E8A24B",
    });
    setTimeout(() => setFeedback(null), 500);

    setScore((s) => s + (quality === "great" ? 100 : 60));
    setStreak((s) => s + 1);

    setNotes((prev) => prev.filter((n) => n.id !== closest.id));
  }


  function gameLoop(t: number) {
    if (cancelledRef.current) return;
    if (spawnedRef.current < SONG_LENGTH && t - lastSpawnRef.current > SPAWN_GAP_MS) {
      const finger = FINGER_ORDER[Math.floor(Math.random() * 4)];
      const newNote: NoteState = { id: noteIdRef.current++, finger, progress: 0, hit: false };
      setNotes((prev) => [...prev, newNote]);
      spawnedRef.current++;
      lastSpawnRef.current = t;
    }

    setNotes((prev) =>
      prev
        .map((n) => ({ ...n, progress: n.progress + 16 / TRAVEL_MS }))
        .filter((n) => {
          if (n.progress > 1.3) {
            if (!n.hit) setStreak(0);
            return false;
          }
          return true;
        })
    );

    gameFrameRef.current = requestAnimationFrame(gameLoop);
  }

  return (
    <div style={{ maxWidth: 480, margin: "0 auto" }}>
      <div
        style={{
          position: "relative",
          borderRadius: 12,
          overflow: "hidden",
          background: "#000",
          aspectRatio: "16 / 9",
          display: isReady ? "block" : "none",
          marginBottom: 12,
        }}
      >
        <video
          ref={videoRef}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            transform: "scaleX(-1)",
          }}
          playsInline
          muted
        />
        <canvas
          ref={canvasRef}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
        />
      </div>


      {onExit && (
        <div style={{ padding: "12px 0" }}>
          <button
            type="button"
            onClick={onExit}
            style={{
              border: "1px solid #ddd",
              borderRadius: 999,
              padding: "6px 14px",
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            ← Back to the island
          </button>
        </div>
      )}

      {error && <div style={{ textAlign: "center", padding: 20 }}>{error}</div>}
      {!isReady && !error && (
        <div style={{ textAlign: "center", padding: 20 }}>Starting camera...</div>
      )}

      {isReady && (
        <>
          <div
            style={{
              background: "#f5f5f0",
              borderRadius: 12,
              padding: 12,
              marginBottom: 12,
              fontSize: 12,
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: 6 }}>
              Live distances (lower = closer to thumb)
            </div>
            {FINGER_ORDER.map((f) => (
              <div
                key={f}
                style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}
              >
                <span style={{ width: 50, color: FINGER_COLOR[f] }}>{f}</span>
                <div style={{ flex: 1, background: "#e0e0d8", height: 8, borderRadius: 4 }}>
                  <div
                    style={{
                      width: `${Math.min(100, (liveDistances?.[f] ?? 1) * 100)}%`,
                      background: activeFinger === f ? FINGER_COLOR[f] : "#bbb",
                      height: 8,
                      borderRadius: 4,
                    }}
                  />
                </div>
                <span style={{ width: 36, textAlign: "right" }}>
                  {liveDistances ? liveDistances[f].toFixed(2) : "—"}
                </span>
              </div>
            ))}
            <div style={{ marginTop: 6, fontWeight: 700 }}>Active: {activeFinger ?? "none"}</div>
          </div>

          <div
            style={{
              position: "relative",
              height: 360,
              borderRadius: 16,
              overflow: "hidden",
              color: "#F4EEDC",
              background:
                "radial-gradient(120% 70% at 50% 0%, #4C3B7A 0%, #2B2450 45%, #14122B 100%)",
              boxShadow: "inset 0 -40px 60px rgba(0,0,0,0.45)",
            }}
          >
            {/* moon + fireflies + grove silhouette make the stage feel alive */}
            <div
              style={{
                position: "absolute",
                top: 26,
                right: 28,
                width: 44,
                height: 44,
                borderRadius: "50%",
                background: "radial-gradient(circle at 35% 35%, #FFF6D8, #F0D890)",
                boxShadow: "0 0 30px rgba(255,240,200,0.55)",
              }}
            />
            {[
              [12, 60], [30, 120], [55, 40], [72, 150], [88, 90], [20, 200], [64, 240],
            ].map(([leftPct, top], i) => (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: `${leftPct}%`,
                  top,
                  width: 4,
                  height: 4,
                  borderRadius: "50%",
                  background: "#FFE9A8",
                  opacity: 0.85,
                  boxShadow: "0 0 8px #FFD86B",
                }}
              />
            ))}
            <svg
              viewBox="0 0 400 120"
              preserveAspectRatio="none"
              style={{ position: "absolute", bottom: 52, left: 0, width: "100%", height: 110, opacity: 0.85 }}
            >
              <polygon points="30,120 55,10 80,120" fill="#122A22" />
              <polygon points="90,120 120,26 150,120" fill="#0E241D" />
              <polygon points="250,120 280,18 310,120" fill="#0E241D" />
              <polygon points="320,120 350,34 380,120" fill="#122A22" />
              <rect x="0" y="104" width="400" height="16" fill="#0B1A16" />
            </svg>

            <div
              style={{
                position: "absolute",
                top: 8,
                left: 0,
                right: 0,
                textAlign: "center",
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              Score: {score} · Streak: {streak}
            </div>
            {feedback && (
              <div
                style={{
                  position: "absolute",
                  bottom: 100,
                  left: 0,
                  right: 0,
                  textAlign: "center",
                  fontWeight: 700,
                  color: feedback.color,
                }}
              >
                {feedback.text}
              </div>
            )}
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
              }}
            >
              {FINGER_ORDER.map((f) => (
                <div key={f} style={{ position: "relative", borderRight: "1px solid #eee" }}>
                  <div
                    style={{
                      position: "absolute",
                      bottom: 70,
                      left: 4,
                      right: 4,
                      height: 8,
                      background: "#eee",
                      borderRadius: 4,
                    }}
                  />
                  {notes
                    .filter((n) => n.finger === f)
                    .map((n) => (
                      <div
                        key={n.id}
                        style={{
                          position: "absolute",
                          left: 6,
                          right: 6,
                          top: `${n.progress * 78}%`,
                          height: 24,
                          background: FINGER_COLOR[f],
                          borderRadius: 6,
                        }}
                      />
                    ))}
                </div>
              ))}
            </div>
            <div
              style={{
                position: "absolute",
                bottom: 0,
                left: 0,
                right: 0,
                height: 60,
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: 4,
                padding: 4,
              }}
            >
              {FINGER_ORDER.map((f) => (
                <div
                  key={f}
                  style={{
                    background: activeFinger === f ? FINGER_COLOR[f] : "#ddd",
                    borderRadius: 10,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 11,
                    fontWeight: 700,
                    color: activeFinger === f ? "white" : "#888",
                    transition: "background 100ms",
                  }}
                >
                  {f}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
