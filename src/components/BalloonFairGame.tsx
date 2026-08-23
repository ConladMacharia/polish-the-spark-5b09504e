// src/components/BalloonFairGame.tsx
// v2 — real balloon/arrow shapes, center-forward shooting perspective,
// gentle capped wind, swaying trees, and drifting birds.
// Two-hand tracking unchanged: bow hand aims, string hand pinches to nock
// and pulls back to draw. No hard fail state — arrows are unlimited.

import { useEffect, useRef, useState } from "react";
import { HandLandmarker } from "@mediapipe/tasks-vision";
import { getTwoHandLandmarker, startCameraStream, attachStream } from "@/lib/pose/handLandmarker";
import { TrackingWatchdog } from "@/lib/pose/trackingWatchdog";
import { HAND_LANDMARKS } from "@/lib/pose/fingerUtils";

interface BalloonFairGameProps {
  bowHand: "left" | "right";
  maxDrawDistance?: number;
  balloonHitRadiusScale?: number;
  windStrength?: number;
}

const STAGE_W = 520;
const STAGE_H = 460;
const POWER_BALLOON_CHANCE = 0.15;
const BOW_ORIGIN = { x: STAGE_W / 2, y: STAGE_H - 30 };
const PINCH_THRESHOLD = 0.06;

const BALLOON_COLORS: [string, string][] = [
  ["#E85555", "#FF9E9E"],
  ["#4F8FE8", "#9EC6FF"],
  ["#7EC85B", "#C3F0A8"],
  ["#E8C24B", "#FFE79E"],
  ["#B15BE8", "#E0AEFF"],
  ["#E87FB0", "#FFC2DE"],
];

const TREE_SPECS = [
  { left: "6%", bottom: "46%", size: 90, opacity: 0.95 },
  { left: "82%", bottom: "46%", size: 90, opacity: 0.95 },
  { left: "-2%", bottom: "40%", size: 60, opacity: 0.75 },
  { left: "92%", bottom: "40%", size: 60, opacity: 0.75 },
  { left: "20%", bottom: "44%", size: 40, opacity: 0.55 },
  { left: "72%", bottom: "44%", size: 40, opacity: 0.55 },
];

interface Balloon {
  id: number;
  x: number;
  baseY: number;
  depth: number;
  bobPhase: number;
  color: string;
  highlight: string;
  power: boolean;
}
interface Arrow {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  scale: number;
}
interface Bird {
  id: number;
  x: number;
  y: number;
  dir: 1 | -1;
  speed: number;
  bobPhase: number;
}

export function BalloonFairGame({
  bowHand,
  maxDrawDistance = 0.35,
  balloonHitRadiusScale = 1,
  windStrength = 1,
}: BalloonFairGameProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const landmarkerRef = useRef<HandLandmarker | null>(null);
  const isDetectingRef = useRef(false);
  const lastVideoTimeRef = useRef(-1);
  const watchdogRef = useRef<TrackingWatchdog | null>(null);
  const isMountedRef = useRef(true);
  const detectionFrameRef = useRef<number | null>(null);
  const gameFrameRef = useRef<number | null>(null);

  const aimRef = useRef({ x: STAGE_W / 2, y: STAGE_H * 0.35 });
  const isDrawingRef = useRef(false);
  const drawRatioRef = useRef(0);
  const balloonsRef = useRef<Balloon[]>([]);
  const arrowsRef = useRef<Arrow[]>([]);
  const birdsRef = useRef<Bird[]>([]);
  const windXRef = useRef(0);
  const windTimerRef = useRef(0);
  const birdTimerRef = useRef(0);
  const idCounter = useRef(0);

  const [isReady, setIsReady] = useState(false);
  const [trackingNotice, setTrackingNotice] = useState<string | null>(null);
  const [aim, setAim] = useState({ x: STAGE_W / 2, y: STAGE_H * 0.35 });
  const [drawRatio, setDrawRatio] = useState(0);
  const [balloons, setBalloons] = useState<Balloon[]>([]);
  const [arrows, setArrows] = useState<Arrow[]>([]);
  const [birds, setBirds] = useState<Bird[]>([]);
  const [treeLean, setTreeLean] = useState(0);
  const [popped, setPopped] = useState(0);
  const [streak, setStreak] = useState(0);
  const [windLabel, setWindLabel] = useState("Wind: calm");

  useEffect(() => {
    for (let i = 0; i < 5; i++) spawnBalloon();
    setBalloons([...balloonsRef.current]);
  }, []);

  useEffect(() => {
    let stream: MediaStream | null = null;
    isMountedRef.current = true;

    async function setup() {
      const [landmarker, mediaStream] = await Promise.all([
        getTwoHandLandmarker(),
        startCameraStream(),
      ]);
      landmarkerRef.current = landmarker;
      stream = mediaStream;
      if (!isMountedRef.current) {
        // component was unmounted while camera permission was pending
        mediaStream.getTracks().forEach((t) => t.stop());
        return;
      }
      if (videoRef.current) await attachStream(videoRef.current, mediaStream);
      watchdogRef.current = new TrackingWatchdog({
        twoHands: true,
        video: () => videoRef.current,
        onLandmarker: (l) => {
          landmarkerRef.current = l;
        },
        onStream: (s) => {
          stream = s;
        },
        onStatus: setTrackingNotice,
      });
      watchdogRef.current.markDetection();
      if (!isMountedRef.current) return;
      setIsReady(true);
      detectionFrameRef.current = requestAnimationFrame(detectionLoop);
      gameFrameRef.current = requestAnimationFrame(gameLoop);
    }
    setup().catch((err) => console.error("Setup failed:", err));

    return () => {
      watchdogRef.current?.dispose();
      isMountedRef.current = false;
      if (detectionFrameRef.current !== null) cancelAnimationFrame(detectionFrameRef.current);
      if (gameFrameRef.current !== null) cancelAnimationFrame(gameFrameRef.current);
      stream?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function spawnBalloon() {
    const isPower = Math.random() < POWER_BALLOON_CHANCE;
    const depth = 0.35 + Math.random() * 0.65;
    const [color, highlight] = BALLOON_COLORS[Math.floor(Math.random() * BALLOON_COLORS.length)];
    balloonsRef.current.push({
      id: idCounter.current++,
      x: 70 + Math.random() * (STAGE_W - 140),
      baseY: 40 + (1 - depth) * 140,
      depth,
      bobPhase: Math.random() * Math.PI * 2,
      color,
      highlight,
      power: isPower,
    });
  }

  function spawnBird() {
    const rightToLeft = Math.random() < 0.5;
    birdsRef.current.push({
      id: idCounter.current++,
      x: rightToLeft ? STAGE_W + 20 : -20,
      y: 20 + Math.random() * 90,
      dir: rightToLeft ? -1 : 1,
      speed: 0.7 + Math.random() * 0.5,
      bobPhase: Math.random() * Math.PI * 2,
    });
  }

  function fireArrow(powerRatio: number) {
    const dx = aimRef.current.x - BOW_ORIGIN.x;
    const dy = aimRef.current.y - BOW_ORIGIN.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const speed = 6 + powerRatio * 10;
    arrowsRef.current.push({
      id: idCounter.current++,
      x: BOW_ORIGIN.x,
      y: BOW_ORIGIN.y,
      vx: (dx / dist) * speed,
      vy: (dy / dist) * speed,
      life: 0,
      scale: 1.5,
    });
  }

  function detectionLoop() {
    if (!isMountedRef.current) return;
    watchdogRef.current?.markFrame();

    const video = videoRef.current;
    const landmarker = landmarkerRef.current;
    if (!video || !landmarker) {
      detectionFrameRef.current = requestAnimationFrame(detectionLoop);
      return;
    }
    if (isDetectingRef.current || video.currentTime === lastVideoTimeRef.current) {
      detectionFrameRef.current = requestAnimationFrame(detectionLoop);
      return;
    }
    isDetectingRef.current = true;
    lastVideoTimeRef.current = video.currentTime;

    const result = landmarker.detectForVideo(video, performance.now());
    if (result.landmarks.length > 0) watchdogRef.current?.markDetection();

    // MediaPipe has used both `handedness` and `handednesses` across
    // versions — check both so this doesn't silently break on a version bump.
    const handednessData: any[] =
      (result as any).handednesses ?? (result as any).handedness ?? [];

    if (result.landmarks.length === 2 && handednessData.length === 2) {
      let bowLm: any = null;
      let stringLm: any = null;

      handednessData.forEach((h, i) => {
        const label = h?.[0]?.categoryName?.toLowerCase();
        if (!label) return;
        if (label === bowHand) bowLm = result.landmarks[i];
        else stringLm = result.landmarks[i];
      });

      if (bowLm && stringLm) {
        const bowPalm = averagePoint(bowLm, [0, 5, 9, 13, 17]);
        const stringThumb = stringLm[HAND_LANDMARKS.THUMB_TIP];
        const stringIndex = stringLm[HAND_LANDMARKS.INDEX_TIP];
        const stringPinchDist = Math.hypot(
          stringThumb.x - stringIndex.x,
          stringThumb.y - stringIndex.y
        );
        const isPinched = stringPinchDist < PINCH_THRESHOLD;
        const stringPalm = averagePoint(stringLm, [0, 5, 9, 13, 17]);

        if (isPinched) {
          if (!isDrawingRef.current) {
            isDrawingRef.current = true;
            aimRef.current = { x: bowPalm.x * STAGE_W, y: bowPalm.y * STAGE_H };
          }
          const handDist = Math.hypot(bowPalm.x - stringPalm.x, bowPalm.y - stringPalm.y);
          drawRatioRef.current = Math.min(1, handDist / maxDrawDistance);
        } else {
          if (isDrawingRef.current && drawRatioRef.current > 0.08) {
            fireArrow(drawRatioRef.current);
          }
          isDrawingRef.current = false;
          drawRatioRef.current = 0;
          aimRef.current = { x: bowPalm.x * STAGE_W, y: bowPalm.y * STAGE_H };
        }
      }
    }

    isDetectingRef.current = false;
    detectionFrameRef.current = requestAnimationFrame(detectionLoop);
  }

  function updateWind(t: number) {
    if (t - windTimerRef.current > 5000) {
      windXRef.current = (Math.random() - 0.5) * 0.5 * windStrength;
      windTimerRef.current = t;
    }
    const strength = Math.abs(windXRef.current);
    const dir = windXRef.current > 0.08 ? "→" : windXRef.current < -0.08 ? "←" : "";
    setWindLabel(strength < 0.08 ? "Wind: calm" : `Wind: light ${dir}`);
  }

  function gameLoop(t: number) {
    if (!isMountedRef.current) return;

    updateWind(t);
    setAim({ ...aimRef.current });
    setDrawRatio(drawRatioRef.current);
    setTreeLean(windXRef.current * 14);

    if (t - birdTimerRef.current > 3500) {
      spawnBird();
      birdTimerRef.current = t;
    }
    birdsRef.current.forEach((b) => {
      b.x += b.dir * b.speed;
    });
    birdsRef.current = birdsRef.current.filter((b) => b.x > -30 && b.x < STAGE_W + 30);
    setBirds([...birdsRef.current]);

    arrowsRef.current.forEach((a) => {
      const windEffect = windXRef.current * Math.min(1, a.life / 60) * 0.35;
      a.vx += windEffect * 0.02;
      a.x += a.vx;
      a.y += a.vy;
      a.life++;
      a.scale = Math.max(0.7, 1.5 - a.life * 0.01);
    });

    balloonsRef.current.forEach((b) => {
      const size = 34 + b.depth * 60;
      const by = b.baseY + Math.sin(t / 900 + b.bobPhase) * 8;
      const centerX = b.x + size / 2;
      const centerY = by + size * 0.6;
      const radius = size * 0.45 * balloonHitRadiusScale;

      arrowsRef.current.forEach((a) => {
        if ((a as any)._hit) return;
        if (Math.hypot(a.x - centerX, a.y - centerY) < radius) {
          (a as any)._hit = true;
          (b as any)._hit = true;
          setPopped((p) => p + (b.power ? 5 : 1));
          setStreak((s) => s + 1);
        }
      });
    });

    const hitIds = balloonsRef.current.filter((b) => (b as any)._hit).map((b) => b.id);
    if (hitIds.length > 0) {
      balloonsRef.current = balloonsRef.current.filter((b) => !(b as any)._hit);
      hitIds.forEach(() => spawnBalloon());
    }

    arrowsRef.current = arrowsRef.current.filter(
      (a) =>
        !(a as any)._hit &&
        a.x > -30 &&
        a.x < STAGE_W + 30 &&
        a.y > -30 &&
        a.y < STAGE_H + 30 &&
        a.life < 260
    );

    setBalloons([...balloonsRef.current]);
    setArrows([...arrowsRef.current]);

    gameFrameRef.current = requestAnimationFrame(gameLoop);
  }

  return (
    <div style={{ maxWidth: STAGE_W, margin: "0 auto" }}>
      <video ref={videoRef} style={{ display: "none" }} playsInline muted />

      {trackingNotice && (
        <div
          style={{
            textAlign: "center",
            fontSize: 12,
            fontWeight: 700,
            color: "#8a6d3b",
            background: "#fff6e0",
            borderRadius: 999,
            padding: "6px 12px",
            margin: "8px auto",
            maxWidth: 260,
          }}
        >
          {trackingNotice}
        </div>
      )}


      {!isReady && <div style={{ textAlign: "center", padding: 20 }}>Starting camera...</div>}

      {isReady && (
        <>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", marginBottom: 10 }}>
            <Stat label="Popped" value={popped} />
            <Stat label="Streak" value={streak} />
          </div>

          <div
            style={{
              position: "relative",
              width: STAGE_W,
              height: STAGE_H,
              borderRadius: 18,
              overflow: "hidden",
              background:
                "linear-gradient(180deg, #9FD3EE 0%, #CFE9C4 45%, #7FAE5A 45%, #4E7A34 100%)",
            }}
          >
            <div
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                bottom: "44%",
                height: 70,
                background: "linear-gradient(180deg, rgba(140,160,150,0.4), rgba(140,160,150,0))",
                clipPath:
                  "polygon(0% 100%, 10% 40%, 25% 70%, 40% 20%, 55% 60%, 70% 30%, 85% 65%, 100% 100%)",
              }}
            />

            {TREE_SPECS.map((t, i) => (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: t.left,
                  bottom: t.bottom,
                  fontSize: t.size,
                  opacity: t.opacity,
                  transformOrigin: "bottom center",
                  transform: `rotate(${treeLean + Math.sin(Date.now() / 1400 + i * 1.3) * 2}deg)`,
                  transition: "transform 0.3s ease-out",
                }}
              >
                🌲
              </div>
            ))}

            {birds.map((b) => (
              <div
                key={b.id}
                style={{
                  position: "absolute",
                  left: b.x,
                  top: b.y + Math.sin(Date.now() / 500 + b.bobPhase) * 4,
                  fontSize: 16,
                  transform: b.dir < 0 ? "scaleX(-1)" : "scaleX(1)",
                }}
              >
                🐦
              </div>
            ))}

            <div
              style={{
                position: "absolute",
                top: 8,
                left: "50%",
                transform: "translateX(-50%)",
                fontSize: 12,
                background: "rgba(0,0,0,0.35)",
                color: "white",
                padding: "3px 12px",
                borderRadius: 999,
                zIndex: 20,
              }}
            >
              {windLabel}
            </div>

            {balloons.map((b) => {
              const size = 34 + b.depth * 60;
              const y = b.baseY + Math.sin(Date.now() / 900 + b.bobPhase) * 8;
              return (
                <div
                  key={b.id}
                  style={{
                    position: "absolute",
                    left: b.x,
                    top: y,
                    width: size,
                    height: size * 1.5,
                    filter: b.power
                      ? "drop-shadow(0 0 8px gold)"
                      : "drop-shadow(0 3px 3px rgba(0,0,0,0.25))",
                  }}
                >
                  <svg width="100%" height="100%" viewBox="0 0 60 90">
                    <ellipse cx="30" cy="34" rx="26" ry="32" fill={b.color} />
                    <ellipse cx="21" cy="20" rx="8" ry="12" fill={b.highlight} opacity={0.55} />
                    <polygon points="26,64 34,64 30,72" fill={b.color} />
                    <path d="M30,72 Q26,80 30,90" stroke="#5b4a3a" strokeWidth="2" fill="none" />
                  </svg>
                </div>
              );
            })}

            {arrows.map((a) => {
              const angle = Math.atan2(a.vy, a.vx);
              return (
                <div
                  key={a.id}
                  style={{
                    position: "absolute",
                    left: a.x,
                    top: a.y,
                    width: 46 * a.scale,
                    height: 10 * a.scale,
                    transform: `translate(-30%, -50%) rotate(${angle}rad)`,
                  }}
                >
                  <svg width="100%" height="100%" viewBox="0 0 46 10">
                    <line x1="2" y1="5" x2="38" y2="5" stroke="#7a5230" strokeWidth={3} />
                    <polygon points="38,0 46,5 38,10" fill="#3a2a1a" />
                    <polygon points="2,1 8,5 2,9" fill="#E85555" />
                  </svg>
                </div>
              );
            })}

            <div
              style={{
                position: "absolute",
                bottom: 6,
                left: "50%",
                transform: "translateX(-50%)",
                fontSize: 46,
                zIndex: 15,
                filter: "drop-shadow(0 4px 4px rgba(0,0,0,0.3))",
              }}
            >
              🏹
            </div>

            <div
              style={{
                position: "absolute",
                left: aim.x,
                top: aim.y,
                width: 30,
                height: 30,
                border: "3px solid rgba(232,85,85,0.9)",
                borderRadius: "50%",
                transform: "translate(-50%,-50%)",
                boxShadow: "0 0 0 2px rgba(255,255,255,0.5)",
                zIndex: 12,
              }}
            />

            <div
              style={{
                position: "absolute",
                bottom: 10,
                left: 10,
                width: 90,
                height: 9,
                background: "rgba(0,0,0,0.35)",
                borderRadius: 5,
                overflow: "hidden",
                zIndex: 15,
              }}
            >
              <div
                style={{
                  height: "100%",
                  background: "linear-gradient(90deg, #E8A24B, #E85555)",
                  width: `${Math.round(drawRatio * 100)}%`,
                }}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function averagePoint(landmarks: any[], indices: number[]) {
  const pts = indices.map((i) => landmarks[i]);
  return {
    x: pts.reduce((s, p) => s + p.x, 0) / pts.length,
    y: pts.reduce((s, p) => s + p.y, 0) / pts.length,
  };
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.7)",
        borderRadius: 10,
        padding: "6px 14px",
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: 16, fontWeight: 700 }}>{value}</div>
      <div style={{ fontSize: 9, color: "#4B5A3A", textTransform: "uppercase" }}>{label}</div>
    </div>
  );
}
