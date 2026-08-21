// src/components/PianoGroveGame.tsx
// Camera-tracked version of Piano Grove. Replaces tap input with real
// thumb-to-finger touch detection. Includes a live debug panel showing
// all 4 raw distances — this is the actual accuracy test, not just the game.

import { useEffect, useRef, useState } from "react";
import type { HandLandmarker } from "@mediapipe/tasks-vision";
import { getHandLandmarker } from "@/lib/pose/handLandmarker";
import { getFingerDistances, getActiveFinger, TOUCH_THRESHOLD, type FingerName } from "@/lib/pose/fingerUtils";
import {
  handConfidence,
  blendConfidence,
  JitterMonitor,
  tolerantThreshold,
} from "@/lib/pose/adaptiveTracking";

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
  const isDetectingRef = useRef(false);
  const lastVideoTimeRef = useRef(-1);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const jitterRef = useRef(new JitterMonitor());

  const [isReady, setIsReady] = useState(false);
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

    async function setup() {
      landmarkerRef.current = await getHandLandmarker();

      stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
        audio: false,
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setIsReady(true);
      requestAnimationFrame(detectionLoop);
      requestAnimationFrame(gameLoop);
    }

    setup().catch((err) => console.error("Setup failed:", err));

    return () => {
      if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current);
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

    if (result.landmarks.length > 0) {
      const lm = result.landmarks[0];
      const distances = getFingerDistances(lm);
      setLiveDistances(distances);

      // Confidence-aware touch threshold: dim light / shaky hands get judged
      // a little more generously instead of taps simply being rejected.
      const stability = jitterRef.current.push({ x: lm[0].x, y: lm[0].y });
      const conf = blendConfidence(
        handConfidence(result),
        jitterRef.current.stability ?? stability
      );
      const active = getActiveFinger(distances, tolerantThreshold(TOUCH_THRESHOLD, conf, 0.4));
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
    } else {
      setLiveDistances(null);
      setActiveFinger(null);
    }

    isDetectingRef.current = false;
    animationFrameRef.current = requestAnimationFrame(detectionLoop);
  }

  function handleTouch(finger: FingerName) {
    const candidates = notesRef.current.filter((n) => n.finger === finger && !n.hit);
    if (candidates.length === 0) return;

    const closest = candidates.reduce((a, b) =>
      Math.abs(a.progress - 1) < Math.abs(b.progress - 1) ? a : b
    );

    const distFromTarget = Math.abs(closest.progress - 1);
    if (distFromTarget > 0.25) return;

    closest.hit = true;
    playTone(finger);

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

    requestAnimationFrame(gameLoop);
  }

  return (
    <div style={{ maxWidth: 480, margin: "0 auto" }}>
      <video ref={videoRef} style={{ display: "none" }} playsInline muted />

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

      {!isReady && <div style={{ textAlign: "center", padding: 20 }}>Starting camera...</div>}

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
              background: "white",
              borderRadius: 16,
              overflow: "hidden",
            }}
          >
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
