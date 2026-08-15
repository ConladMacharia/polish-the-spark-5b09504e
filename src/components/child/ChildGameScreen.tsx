import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

import { getHandLandmarker } from "@/lib/pose/handLandmarker";
import {
  crossesMidline,
  fistClosure,
  isPinching,
  palmCenter,
  PointSmoother,
  scissorAmount,
  thumbTouchIndex,
  twoWristSymmetry,
  type Hand,
} from "@/lib/pose/handMechanics";
import { Staircase, type ChildGame, type Eligibility } from "@/lib/child-games";
import { Rafiki } from "@/components/child/Rafiki";

type Target = { id: number; x: number; y: number; drifting: boolean };

const CHEERS = ["Yaaay!", "Nice one!", "Wow!", "Rafiki loves it!", "Beautiful!", "Again!"];
const NUDGES = ["Almost!", "Keep going!", "You can do it!", "Try with me!"];

export function ChildGameScreen({
  game,
  variant,
  onExit,
}: {
  game: ChildGame;
  variant: Eligibility;
  onExit: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const rafRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const smoother = useRef(new PointSmoother(0.4));
  const staircase = useRef(new Staircase(game.range, variant === "simplified"));
  const holdRef = useRef<{ id: number | null; frames: number }>({ id: null, frames: 0 });
  const seqRef = useRef(0);
  const lastMissRef = useRef(0);

  const [ready, setReady] = useState(false);
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);
  const [targets, setTargets] = useState<Target[]>(() => spawn(game, 0));
  const [collected, setCollected] = useState(0);
  const [mascotSays, setMascotSays] = useState(game.invite);
  const [mascotMood, setMascotMood] = useState<"idle" | "cheer" | "encourage">("idle");
  const [rewardOpen, setRewardOpen] = useState(false);
  const [sparkles, setSparkles] = useState<{ id: number; x: number; y: number }[]>([]);

  // ---- camera + hand tracking ----------------------------------------------
  useEffect(() => {
    let cancelled = false;

    async function start() {
      try {
        const [landmarker, stream] = await Promise.all([
          getHandLandmarker(),
          navigator.mediaDevices.getUserMedia({
            video: { facingMode: "user", width: 640, height: 480 },
            audio: false,
          }),
        ]);
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();
        setReady(true);

        const loop = () => {
          if (cancelled || !videoRef.current) return;
          const v = videoRef.current;
          if (v.readyState >= 2) {
            const res = landmarker.detectForVideo(v, performance.now());
            const hands = (res.landmarks ?? []) as Hand[];
            if (hands.length > 0) handleFrame(hands);
          }
          rafRef.current = requestAnimationFrame(loop);
        };
        rafRef.current = requestAnimationFrame(loop);
      } catch {
        // camera unavailable — Rafiki still keeps things warm, never a fail state
        setMascotSays("Rafiki can't see you yet — that's okay!");
      }
    }

    start();
    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.id]);

  function cheer(x?: number, y?: number) {
    setMascotMood("cheer");
    setMascotSays(CHEERS[Math.floor(Math.random() * CHEERS.length)]);
    if (x !== undefined && y !== undefined) {
      const id = Date.now() + Math.random();
      setSparkles((s) => [...s, { id, x, y }]);
      setTimeout(() => setSparkles((s) => s.filter((p) => p.id !== id)), 900);
    }
    setTimeout(() => setMascotMood("idle"), 1200);
  }

  function encourage() {
    const now = performance.now();
    if (now - lastMissRef.current < 2500) return;
    lastMissRef.current = now;
    setMascotMood("encourage");
    setMascotSays(NUDGES[Math.floor(Math.random() * NUDGES.length)]);
    setTimeout(() => setMascotMood("idle"), 1400);
  }

  function succeed(x?: number, y?: number) {
    staircase.current.record(true);
    cheer(x, y);
    setCollected((c) => {
      const next = c + 1;
      if (next >= game.roundsToReward) setRewardOpen(true);
      return next;
    });
    setTargets(() => spawn(game, Math.random()));
  }

  /** Near-miss: object simply drifts away, never a fail. */
  function drift(id: number) {
    staircase.current.record(false);
    encourage();
    setTargets((ts) => ts.map((t) => (t.id === id ? { ...t, drifting: true } : t)));
    setTimeout(() => setTargets(() => spawn(game, Math.random())), 700);
  }

  function handleFrame(hands: Hand[]) {
    const hand = hands[0];
    const tol = staircase.current.value;

    // Mechanic B / cursor position — used by nearly every game for aiming.
    const raw = palmCenter(hand);
    const pos = smoother.current.push({ x: 1 - raw.x, y: raw.y }); // mirror for selfie view
    setCursor(pos);

    switch (game.mechanic) {
      case "fist": {
        const closure = fistClosure(hand);
        if (closure < tol) {
          if (holdRef.current.id !== -1) {
            holdRef.current = { id: -1, frames: 0 };
            succeed(pos.x, pos.y);
          }
        } else if (closure > tol + 0.25) {
          holdRef.current = { id: null, frames: 0 };
        }
        break;
      }
      case "pinch": {
        const pinching = isPinching(hand, tol);
        const near = nearestTarget(targets, pos);
        if (pinching && near && distance(near, pos) < 0.16) {
          succeed(near.x, near.y);
        } else if (pinching && near) {
          drift(near.id);
        }
        break;
      }
      case "cursor": {
        const reach = game.id === "snip-ribbon" ? scissorAmount(hand) : 0;
        const near = nearestTarget(targets, pos);
        if (!near) break;
        const hit = distance(near, pos) < tol + 0.05;
        const snipOk = game.id !== "snip-ribbon" || reach < 0.9;
        if (hit && snipOk) {
          holdRef.current.frames += 1;
          if (holdRef.current.frames > 4) {
            holdRef.current.frames = 0;
            succeed(near.x, near.y);
          }
        } else {
          holdRef.current.frames = 0;
        }
        break;
      }
      case "crossMidline": {
        const near = nearestTarget(targets, pos);
        if (!near) break;
        const side = raw.x < 0.5 ? "left" : "right";
        if (crossesMidline(hand, 0.5, side) && distance(near, pos) < tol * 0.3 + 0.12) {
          succeed(near.x, near.y);
        }
        break;
      }
      case "thumbSequence": {
        const touched = thumbTouchIndex(hand, tol);
        if (touched === null) break;
        if (touched === seqRef.current) {
          seqRef.current += 1;
          cheer(pos.x, pos.y);
          if (seqRef.current >= (variant === "simplified" ? 2 : 4)) {
            seqRef.current = 0;
            succeed(pos.x, pos.y);
          }
        }
        break;
      }
      case "twoWrist": {
        if (hands.length < 2) {
          if (variant === "simplified") {
            const near = nearestTarget(targets, pos);
            if (near && distance(near, pos) < 0.14) succeed(near.x, near.y);
          }
          break;
        }
        const sym = twoWristSymmetry(hands[0], hands[1], 0.35, tol + 0.08);
        const center = { x: 1 - sym.center.x, y: sym.center.y };
        setCursor(center);
        const near = nearestTarget(targets, center);
        if (sym.steady && near && distance(near, center) < 0.16) succeed(near.x, near.y);
        break;
      }
    }
  }

  return (
    <div className={`fixed inset-0 z-50 overflow-hidden bg-gradient-to-b ${game.gradient}`}>
      <video
        ref={videoRef}
        playsInline
        muted
        className="absolute inset-0 h-full w-full scale-x-[-1] object-cover opacity-25"
      />

      {/* exit — small, quiet, top-left so children don't hit it by accident */}
      <button
        type="button"
        onClick={onExit}
        aria-label="Leave the game"
        className="absolute left-4 top-4 z-30 grid h-11 w-11 place-items-center rounded-full bg-white/70 text-slate-800 shadow"
      >
        <X className="h-5 w-5" />
      </button>

      <div className="pointer-events-none absolute inset-x-0 top-5 z-20 text-center">
        <p className="font-display text-2xl text-white drop-shadow-[0_2px_0_rgba(0,0,0,0.35)]">
          {game.region}
        </p>
      </div>

      {/* targets */}
      {targets.map((t) => (
        <div
          key={t.id}
          className={`absolute z-10 select-none text-6xl transition-all duration-700 ${
            t.drifting ? "-translate-y-24 opacity-0" : "animate-pulse opacity-100"
          }`}
          style={{ left: `${t.x * 100}%`, top: `${t.y * 100}%`, transform: "translate(-50%, -50%)" }}
        >
          {game.emoji}
        </div>
      ))}

      {/* sparkles for warm feedback */}
      {sparkles.map((s) => (
        <div
          key={s.id}
          className="pointer-events-none absolute z-20 animate-ping text-5xl"
          style={{ left: `${s.x * 100}%`, top: `${s.y * 100}%` }}
        >
          🌟
        </div>
      ))}

      {/* hand cursor */}
      {cursor && (
        <div
          className="pointer-events-none absolute z-20 h-16 w-16 rounded-full border-4 border-white/80 bg-white/25 backdrop-blur-sm"
          style={{
            left: `${cursor.x * 100}%`,
            top: `${cursor.y * 100}%`,
            transform: "translate(-50%, -50%)",
          }}
        />
      )}

      {/* Rafiki */}
      <div className="absolute bottom-6 left-1/2 z-30 -translate-x-1/2 text-center">
        <div className="mb-2 inline-block max-w-[18rem] rounded-3xl bg-white/90 px-5 py-2 font-display text-xl text-purple-900 shadow-lg">
          {ready ? mascotSays : "Rafiki is waking up…"}
        </div>
        <Rafiki mood={mascotMood} size={96} />
      </div>

      {/* reward */}
      {rewardOpen && (
        <RewardOverlay
          game={game}
          onDone={() => {
            setRewardOpen(false);
            setCollected(0);
            setTargets(spawn(game, Math.random()));
          }}
          onLeave={onExit}
        />
      )}

      {/* silent collection trail (visual only, no numbers) */}
      <div className="absolute right-4 top-4 z-20 flex flex-col gap-1 text-2xl">
        {Array.from({ length: collected }).map((_, i) => (
          <span key={i}>{game.emoji}</span>
        ))}
      </div>
    </div>
  );
}

function RewardOverlay({
  game,
  onDone,
  onLeave,
}: {
  game: ChildGame;
  onDone: () => void;
  onLeave: () => void;
}) {
  const art: Record<ChildGame["reward"], string> = {
    jar: "🏺✨",
    constellation: "🌌⭐",
    tune: "🎶🎹",
    confetti: "🎉",
    campsite: "⛺🔥",
    picture: "🖼️🌈",
    pop: "🎈🎉",
    ribbon: "🎀🎊",
    basket: "🧺🌻",
    giggle: "☁️😄",
  };
  return (
    <div className="absolute inset-0 z-40 grid place-items-center bg-purple-950/70 backdrop-blur-sm">
      <div className="mx-6 rounded-[2rem] bg-white px-8 py-10 text-center shadow-2xl">
        <div className="animate-bounce text-7xl">{art[game.reward]}</div>
        <p className="mt-4 font-display text-3xl text-purple-900">You did it!</p>
        <div className="mt-6 flex flex-col gap-3">
          <button
            type="button"
            onClick={onDone}
            className="rounded-2xl bg-orange-500 px-8 py-4 font-display text-2xl text-white shadow-[0_4px_0_#9a3412]"
          >
            Play again
          </button>
          <button
            type="button"
            onClick={onLeave}
            className="rounded-2xl bg-purple-100 px-8 py-3 font-display text-xl text-purple-900"
          >
            Back to the island
          </button>
        </div>
      </div>
    </div>
  );
}

function spawn(game: ChildGame, seed: number): Target[] {
  const count = game.mechanic === "cursor" ? 3 : game.mechanic === "fist" ? 1 : 2;
  return Array.from({ length: count }).map((_, i) => ({
    id: Date.now() + i + Math.floor(seed * 1000),
    x: 0.2 + Math.random() * 0.6,
    y: 0.22 + Math.random() * 0.42,
    drifting: false,
  }));
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function nearestTarget(targets: Target[], p: { x: number; y: number }): Target | null {
  let best: Target | null = null;
  let bd = Infinity;
  for (const t of targets) {
    if (t.drifting) continue;
    const d = distance(t, p);
    if (d < bd) {
      bd = d;
      best = t;
    }
  }
  return best;
}
