// src/components/SpaceExplorerGame.tsx
// Rocket's vertical position driven by real palm height (Hands landmarker).
// No hard fail state — a hit wobbles/slows the rocket, run continues.

import { useEffect, useRef, useState } from "react";
import { HandLandmarker } from "@mediapipe/tasks-vision";
import { getHandLandmarker } from "@/lib/pose/handLandmarker";

interface Obstacle {
  x: number;
  gapCenter: number;
  passed: boolean;
}
interface Collectible {
  x: number;
  y: number;
  collected: boolean;
}

interface SpaceExplorerGameProps {
  // Difficulty parameters — read from the per-child target/range system
  gapHeight?: number; // wider = easier
  baseSpeed?: number;
}

const STAGE_W = 460;
const STAGE_H = 420;
const MIN_SPEED = 2.2;
const MAX_SPEED = 9;

export function SpaceExplorerGame({ gapHeight = 150, baseSpeed = 4.2 }: SpaceExplorerGameProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const landmarkerRef = useRef<HandLandmarker | null>(null);
  const isDetectingRef = useRef(false);
  const lastVideoTimeRef = useRef(-1);

  const handYRef = useRef(STAGE_H / 2); // raw tracked hand height, in stage pixels
  const rocketYRef = useRef(STAGE_H / 2);
  const obstaclesRef = useRef<Obstacle[]>([]);
  const collectiblesRef = useRef<Collectible[]>([]);
  const speedRef = useRef(baseSpeed);
  const invulnerableRef = useRef(false);
  const lastSpawnRef = useRef(0);
  const lastItemSpawnRef = useRef(0);
  const startTimeRef = useRef(0);

  const [isReady, setIsReady] = useState(false);
  const [rocketY, setRocketY] = useState(STAGE_H / 2);
  const [obstacles, setObstacles] = useState<Obstacle[]>([]);
  const [collectibles, setCollectibles] = useState<Collectible[]>([]);
  const [distance, setDistance] = useState(0);
  const [items, setItems] = useState(0);
  const [closeCalls, setCloseCalls] = useState(0);
  const [isHit, setIsHit] = useState(false);
  const [speed, setSpeed] = useState(baseSpeed);

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
      stream?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function detectionLoop() {
    const video = videoRef.current;
    const landmarker = landmarkerRef.current;
    if (!video || !landmarker) {
      requestAnimationFrame(detectionLoop);
      return;
    }
    if (isDetectingRef.current || video.currentTime === lastVideoTimeRef.current) {
      requestAnimationFrame(detectionLoop);
      return;
    }
    isDetectingRef.current = true;
    lastVideoTimeRef.current = video.currentTime;

    const result = landmarker.detectForVideo(video, performance.now());
    if (result.landmarks.length > 0) {
      const lm = result.landmarks[0];
      // Palm center = average of wrist + 4 MCP joints
      const palmPoints = [lm[0], lm[5], lm[9], lm[13], lm[17]];
      const avgY = palmPoints.reduce((sum, p) => sum + p.y, 0) / palmPoints.length;
      // avgY is normalized 0-1 (0 = top of frame); map to stage pixels
      const targetY = avgY * STAGE_H;
      // smooth toward target
      handYRef.current += (targetY - handYRef.current) * 0.75;
    }

    isDetectingRef.current = false;
    requestAnimationFrame(detectionLoop);
  }

  function registerHit() {
    invulnerableRef.current = true;
    setIsHit(true);
    // Planets are penalties: they permanently shave speed off the run.
    speedRef.current = Math.max(MIN_SPEED, speedRef.current - 0.8);
    setSpeed(speedRef.current);
    setCloseCalls((c) => c + 1);
    setTimeout(() => {
      setIsHit(false);
      invulnerableRef.current = false;
    }, 700);
  }

  function gameLoop(t: number) {
    if (startTimeRef.current === 0) startTimeRef.current = t;
    const elapsed = (t - startTimeRef.current) / 1000;

    rocketYRef.current += (handYRef.current - rocketYRef.current) * 0.5;
    setRocketY(rocketYRef.current);

    setDistance((d) => d + speedRef.current * 0.05);

    // Planets start sparse and get denser as the run progresses.
    const spawnGap = Math.max(900, 3000 - elapsed * 45);
    if (t - lastSpawnRef.current > spawnGap) {
      const gapCenter = 60 + Math.random() * (STAGE_H - 120);
      obstaclesRef.current.push({ x: STAGE_W + 30, gapCenter, passed: false });
      lastSpawnRef.current = t;
    }
    if (t - lastItemSpawnRef.current > 700) {
      collectiblesRef.current.push({
        x: STAGE_W + 30,
        y: 30 + Math.random() * (STAGE_H - 60),
        collected: false,
      });
      lastItemSpawnRef.current = t;
    }

    obstaclesRef.current.forEach((o) => {
      o.x -= speedRef.current;
      if (!invulnerableRef.current && o.x > 40 && o.x < 90) {
        if (
          rocketYRef.current < o.gapCenter - gapHeight / 2 + 10 ||
          rocketYRef.current > o.gapCenter + gapHeight / 2 - 10
        ) {
          registerHit();
        }
      }
    });
    obstaclesRef.current = obstaclesRef.current.filter((o) => o.x > -40);
    setObstacles([...obstaclesRef.current]);

    collectiblesRef.current.forEach((c) => {
      if (c.collected) return;
      c.x -= speedRef.current;
      const overlap =
        c.x < 100 && c.x + 20 > 60 && c.y < rocketYRef.current + 20 && c.y + 20 > rocketYRef.current - 20;
      if (overlap) {
        c.collected = true;
        setItems((i) => i + 1);
        // Stars are the prize: each one speeds the rocket up a little.
        speedRef.current = Math.min(MAX_SPEED, speedRef.current + 0.35);
        setSpeed(speedRef.current);
      }
    });
    collectiblesRef.current = collectiblesRef.current.filter((c) => c.x > -30 && !c.collected);
    setCollectibles([...collectiblesRef.current]);

    requestAnimationFrame(gameLoop);
  }



  return (
    <div style={{ maxWidth: 460, margin: "0 auto" }}>
      <video ref={videoRef} style={{ display: "none" }} playsInline muted />

      {!isReady && <div style={{ textAlign: "center", padding: 20, color: "white" }}>Starting camera...</div>}

      {isReady && (
        <>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", marginBottom: 10 }}>
            <Stat label="Distance" value={Math.floor(distance)} />
            <Stat label="Items" value={items} />
            <Stat label="Close calls" value={closeCalls} />
          </div>

          <div
            style={{
              position: "relative",
              width: STAGE_W,
              height: STAGE_H,
              margin: "0 auto",
              borderRadius: 18,
              overflow: "hidden",
              background: "radial-gradient(circle at 70% 20%, #24346E, #0B1533 70%)",
            }}
          >
            <div
              style={{
                position: "absolute",
                left: 60,
                top: rocketY,
                width: 40,
                height: 40,
                fontSize: 32,
                transform: "translateY(-50%)",
                filter: isHit ? "drop-shadow(0 0 8px #ff5a5a)" : "none",
              }}
            >
              🚀
            </div>

            {obstacles.map((o, i) => (
              <div key={i}>
                <div style={{ position: "absolute", left: o.x, top: o.gapCenter - gapHeight / 2 - 30, fontSize: 34 }}>
                  🪐
                </div>
                <div style={{ position: "absolute", left: o.x, top: o.gapCenter + gapHeight / 2, fontSize: 34 }}>
                  🪐
                </div>
              </div>
            ))}

            {collectibles.map((c, i) => (
              <div key={i} style={{ position: "absolute", left: c.x, top: c.y, fontSize: 20 }}>
                ⭐
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ background: "rgba(255,255,255,0.08)", borderRadius: 10, padding: "6px 14px", textAlign: "center", color: "white" }}>
      <div style={{ fontSize: 16, fontWeight: 700 }}>{value}</div>
      <div style={{ fontSize: 9, color: "#9AA6D6", textTransform: "uppercase" }}>{label}</div>
    </div>
  );
}
