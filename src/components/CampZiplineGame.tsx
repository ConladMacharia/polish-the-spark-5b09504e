// src/components/CampZiplineGame.tsx
// Zip advances only while pinched AND within the midline channel.
// Releasing pinch or drifting out of the channel PAUSES progress — never resets it.

import { useEffect, useRef, useState } from "react";
import { HandLandmarker } from "@mediapipe/tasks-vision";
import { getHandLandmarker } from "@/lib/pose/handLandmarker";
import { HAND_LANDMARKS } from "@/lib/pose/fingerUtils";

interface CampZiplineGameProps {
  // Difficulty parameter — read from the per-child target/range system
  channelHalfWidth?: number; // wider = easier, in normalized 0-1 coords
}

const STAGE_W = 460;
const STAGE_H = 520;
const TENT_BASE_Y = STAGE_H - 70;
const TENT_HEIGHT = 300; // full tent fabric height, base to peak
const DOOR_HEIGHT = 235; // door opening goes from base up to this height, not the full peak
const DOOR_BASE_WIDTH = 52; // half-width of the door opening at the base
const TENT_RENDER_W = 300; // on-screen tent width (viewBox stays 200 wide)
const CENTER_X = STAGE_W / 2;
// Hysteresis: pinch engages when tighter than CLOSE, only drops past RELEASE.
const PINCH_CLOSE = 0.065;
const PINCH_RELEASE = 0.085;
const PINCH_GRACE_MS = 140; // brief tracking dropouts don't pause the zip

export function CampZiplineGame({ channelHalfWidth = 0.06 }: CampZiplineGameProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const landmarkerRef = useRef<HandLandmarker | null>(null);
  const isDetectingRef = useRef(false);
  const lastVideoTimeRef = useRef(-1);

  const cursorRef = useRef({ x: CENTER_X, y: TENT_BASE_Y });
  const isPinchedRef = useRef(false);
  const lastPinchTimeRef = useRef(0);
  const zipProgressRef = useRef(0); // 0 = open, 1 = fully zipped

  const [isReady, setIsReady] = useState(false);
  const [cursorPos, setCursorPos] = useState({ x: CENTER_X, y: TENT_BASE_Y });
  const [isPinched, setIsPinched] = useState(false);
  const [zipProgress, setZipProgress] = useState(0);
  const [statusText, setStatusText] = useState("Place the zip at the base and pull up");
  const [complete, setComplete] = useState(false);

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
      requestAnimationFrame(loop);
    }
    setup().catch((err) => console.error("Setup failed:", err));

    return () => {
      stream?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function loop() {
    const video = videoRef.current;
    const landmarker = landmarkerRef.current;

    if (video && landmarker && !isDetectingRef.current && video.currentTime !== lastVideoTimeRef.current) {
      isDetectingRef.current = true;
      lastVideoTimeRef.current = video.currentTime;

      const result = landmarker.detectForVideo(video, performance.now());
      if (result.landmarks.length > 0) {
        const lm = result.landmarks[0];
        const thumb = lm[HAND_LANDMARKS.THUMB_TIP];
        const index = lm[HAND_LANDMARKS.INDEX_TIP];

        // cursor position = midpoint between thumb and index (natural pinch center)
        const cx = ((thumb.x + index.x) / 2) * STAGE_W;
        const cy = ((thumb.y + index.y) / 2) * STAGE_H;
        cursorRef.current.x += (cx - cursorRef.current.x) * 0.55;
        cursorRef.current.y += (cy - cursorRef.current.y) * 0.55;

        const pinchDist = Math.sqrt((thumb.x - index.x) ** 2 + (thumb.y - index.y) ** 2);
        const threshold = isPinchedRef.current ? PINCH_RELEASE : PINCH_CLOSE;
        const pinchedNow = pinchDist < threshold;
        if (pinchedNow) {
          lastPinchTimeRef.current = performance.now();
          isPinchedRef.current = true;
        } else if (performance.now() - lastPinchTimeRef.current > PINCH_GRACE_MS) {
          isPinchedRef.current = false;
        }
      }
      isDetectingRef.current = false;
    }

    setCursorPos({ ...cursorRef.current });
    setIsPinched(isPinchedRef.current);

    const inChannel =
      Math.abs(cursorRef.current.x - CENTER_X) <= channelHalfWidth * STAGE_W;

    if (isPinchedRef.current && inChannel && zipProgressRef.current < 1) {
      const targetProgress = Math.min(
        1,
        Math.max(0, (TENT_BASE_Y - cursorRef.current.y) / DOOR_HEIGHT)
      );
      if (targetProgress > zipProgressRef.current) {
        zipProgressRef.current = Math.min(targetProgress, zipProgressRef.current + 0.09);
      }
      setStatusText("Zipping... keep going up!");
    } else if (isPinchedRef.current && !inChannel) {
      setStatusText("Stay centered on the tent door to keep zipping");
    } else {
      setStatusText(
        zipProgressRef.current > 0
          ? "Paused — pinch and stay centered to continue"
          : "Place the zip at the base and pull up"
      );
    }

    setZipProgress(zipProgressRef.current);
    if (zipProgressRef.current >= 0.999) setComplete(true);

    requestAnimationFrame(loop);
  }

  function reset() {
    zipProgressRef.current = 0;
    setComplete(false);
  }

  const zipHeight = zipProgress * DOOR_HEIGHT;
  const remainingDoorWidth = DOOR_BASE_WIDTH * (1 - zipProgress);
  const doorBaseY = TENT_HEIGHT - zipHeight; // svg y-coord (0 = peak, TENT_HEIGHT = base)
  const doorPoints = `${100 - remainingDoorWidth},${doorBaseY} ${100 + remainingDoorWidth},${doorBaseY} 100,${TENT_HEIGHT - DOOR_HEIGHT}`;

  return (
    <div style={{ maxWidth: STAGE_W, margin: "0 auto" }}>
      <video ref={videoRef} style={{ display: "none" }} playsInline muted />

      {!isReady && <div style={{ textAlign: "center", padding: 20 }}>Starting camera...</div>}

      {isReady && (
        <div
          style={{
            position: "relative",
            width: STAGE_W,
            height: STAGE_H,
            borderRadius: 18,
            overflow: "hidden",
            background:
              "linear-gradient(180deg, #BEE3D8 0%, #D8E8B8 55%, #8FBF6E 55%, #6FA855 100%)",
          }}
        >
          <div style={{ position: "absolute", left: 16, top: 60, fontSize: 34 }}>🌲</div>
          <div style={{ position: "absolute", right: 20, top: 40, fontSize: 34 }}>🌳</div>
          <div style={{ position: "absolute", top: 30, fontSize: 16 }}>🐦</div>
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              height: 40,
              background: "linear-gradient(90deg, #7CC8E0, #A9E0EE)",
              borderRadius: "40px 40px 0 0",
              opacity: 0.85,
            }}
          />

          {/* tent pegs */}
          <div style={{ position: "absolute", bottom: 62, left: "calc(50% - 150px)", fontSize: 14, opacity: 0.7 }}>⛏️</div>
          <div style={{ position: "absolute", bottom: 62, left: "calc(50% + 138px)", fontSize: 14, opacity: 0.7 }}>⛏️</div>

          {/* bigger tent with shaded panels for a 3D look */}
          <svg
            width={TENT_RENDER_W}
            height={TENT_HEIGHT}
            viewBox={`0 0 200 ${TENT_HEIGHT}`}
            preserveAspectRatio="none"
            style={{
              position: "absolute",
              left: "50%",
              bottom: 70,
              transform: "translateX(-50%)",
              filter: "drop-shadow(0 8px 12px rgba(0,0,0,0.35))",
            }}
          >
            <defs>
              <linearGradient id="tentLeft" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#8A4E20" />
                <stop offset="70%" stopColor="#C9793C" />
                <stop offset="100%" stopColor="#E9A063" />
              </linearGradient>
              <linearGradient id="tentRight" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#C07437" />
                <stop offset="45%" stopColor="#9C5A28" />
                <stop offset="100%" stopColor="#6E3D18" />
              </linearGradient>
              <radialGradient id="doorGlow" cx="50%" cy="90%" r="80%">
                <stop offset="0%" stopColor="#3A2410" />
                <stop offset="100%" stopColor="#150C04" />
              </radialGradient>
            </defs>

            {/* ground shadow ellipse grounds the tent in the scene */}
            <ellipse cx="100" cy={TENT_HEIGHT - 2} rx="104" ry="9" fill="rgba(0,0,0,0.22)" />

            <polygon points={`100,0 4,${TENT_HEIGHT} 100,${TENT_HEIGHT}`} fill="url(#tentLeft)" />
            <polygon points={`100,0 196,${TENT_HEIGHT} 100,${TENT_HEIGHT}`} fill="url(#tentRight)" />

            {/* fabric folds */}
            <line x1="100" y1="0" x2="46" y2={TENT_HEIGHT} stroke="rgba(255,255,255,0.14)" strokeWidth={2} />
            <line x1="100" y1="0" x2="150" y2={TENT_HEIGHT} stroke="rgba(0,0,0,0.14)" strokeWidth={2} />

            <line x1="100" y1="0" x2="100" y2={TENT_HEIGHT} stroke="#7C4A22" strokeWidth={3} />
            <line x1="4" y1={TENT_HEIGHT} x2="-34" y2={TENT_HEIGHT - 6} stroke="#7C4A22" strokeWidth={2} />
            <line x1="196" y1={TENT_HEIGHT} x2="234" y2={TENT_HEIGHT - 6} stroke="#7C4A22" strokeWidth={2} />

            {/* door opening — shrinks to a point as the zip rises, apex fixed at the door's top */}
            <polygon points={doorPoints} fill="url(#doorGlow)" />
            <polygon points={doorPoints} fill="none" stroke="rgba(255,235,200,0.35)" strokeWidth={1.5} />
          </svg>

          {/* zip seam line + pull tab, following the door's centerline */}
          <div
            style={{
              position: "absolute",
              left: "50%",
              bottom: 70,
              width: 2,
              height: zipHeight,
              background: "rgba(255,255,255,0.6)",
              transform: "translateX(-50%)",
            }}
          />
          <div
            style={{
              position: "absolute",
              left: "50%",
              bottom: 70 + zipHeight,
              width: 14,
              height: 20,
              fontSize: 16,
              transform: "translate(-50%, 50%)",
              filter: "drop-shadow(0 1px 1px rgba(0,0,0,0.3))",
            }}
          >
            🤐
          </div>

          <div
            style={{
              position: "absolute",
              top: 10,
              left: 0,
              right: 0,
              textAlign: "center",
              fontSize: 12,
              fontWeight: 700,
              color: "#3B4A2E",
            }}
          >
            {statusText}
          </div>

          {/* cursor */}
          <div
            style={{
              position: "absolute",
              left: cursorPos.x,
              top: cursorPos.y,
              width: 26,
              height: 26,
              borderRadius: "50%",
              border: `3px solid ${isPinched ? "#C87D2E" : "#E8A24B"}`,
              background: isPinched ? "rgba(232,162,75,0.35)" : "transparent",
              transform: "translate(-50%, -50%)",
              pointerEvents: "none",
            }}
          />

          {complete && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: "rgba(255,255,255,0.95)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                textAlign: "center",
                padding: 20,
              }}
            >
              <div style={{ fontSize: 16, fontWeight: 700 }}>Tent zipped up!</div>
              <div style={{ fontSize: 13, color: "#5F6B54", marginTop: 6 }}>
                A cozy campsite is ready inside.
              </div>
              <button
                onClick={reset}
                style={{
                  marginTop: 14,
                  background: "#3B4A2E",
                  color: "white",
                  border: "none",
                  padding: "10px 20px",
                  borderRadius: 999,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Try again
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
