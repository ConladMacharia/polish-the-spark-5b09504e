import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

import { getHandLandmarker, startCameraStream, attachStream } from "@/lib/pose/handLandmarker";
import {
  FINGER_NAMES,
  FistCycle,
  fistClosePercent,
  hasCrossedMidline,
  isHandOpen,
  isSpreadInRange,
  IsolatedSequenceLatch,
  palmCenter,
  PinchLatch,
  PointSmoother,
  ScissorCycle,
  wristMidpoint,
  wristSpread,
  type Hand,
  type Handedness,
} from "@/lib/pose/handMechanics";

import { Staircase, type ChildGame, type Eligibility } from "@/lib/child-games";
import { Rafiki } from "@/components/child/Rafiki";
import { useLanguage } from "@/lib/i18n/LanguageProvider";

type Target = { id: number; x: number; y: number; drifting: boolean };

const CHEER_KEYS = ["cheer1", "cheer2", "cheer3", "cheer4", "cheer5", "cheer6"] as const;
const NUDGE_KEYS = ["nudge1", "nudge2", "nudge3", "nudge4"] as const;

/** Child-friendly nudge for the one movement this game listens to — translation
 *  key per mechanic. */
const HINT_KEYS: Record<ChildGame["mechanic"], string> = {
  fist: "hintFist",
  pinch: "hintPinch",
  pinchDrag: "hintPinchDrag",
  cursor: "hintCursor",
  crossMidline: "hintCrossMidline",
  thumbSequence: "hintThumbSequence",
  twoWrist: "hintTwoWrist",
  scissor: "hintScissor",
  reachTarget: "hintReachTarget",
  shipFly: "hintShipFly",
};

/** Converts a game id ("cloud-squeeze") into the camelCase suffix used by
 *  the gameInvite_ translation keys. */
function gameKeySuffix(id: string) {
  return id.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
}

export function ChildGameScreen({
  game,
  variant,
  onExit,
}: {
  game: ChildGame;
  variant: Eligibility;
  onExit: () => void;
}) {
  const { t } = useLanguage();
  const videoRef = useRef<HTMLVideoElement>(null);
  const rafRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const smoother = useRef(new PointSmoother(0.4));
  const staircase = useRef(new Staircase(game.range, variant === "simplified"));

  // one latch per mechanic — never shared between games
  const pinchLatch = useRef(new PinchLatch());
  const seqLatch = useRef(new IsolatedSequenceLatch());
  const scissorCycle = useRef(new ScissorCycle());
  const fistCycle = useRef(new FistCycle());
  const dwellRef = useRef(0);

  const steadyRef = useRef(0);
  const crossRef = useRef(false);
  const carriedRef = useRef<Target | null>(null);
  const lastMissRef = useRef(0);

  const [ready, setReady] = useState(false);
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);
  const [targets, setTargets] = useState<Target[]>(() => spawn(game, 0));
  const [collected, setCollected] = useState(0);
  const [mascotSays, setMascotSays] = useState(
    t(`gameInvite_${gameKeySuffix(game.id)}` as any) || game.invite,
  );
  const [mascotMood, setMascotMood] = useState<"idle" | "cheer" | "encourage">("idle");
  const [rewardOpen, setRewardOpen] = useState(false);
  const [sparkles, setSparkles] = useState<{ id: number; x: number; y: number }[]>([]);
  // mechanic-specific display state
  const [squeeze, setSqueeze] = useState(0); // C: 0..100
  const [nextFinger, setNextFinger] = useState<0 | 1 | 2 | 3>(0); // E
  const [carrying, setCarrying] = useState(false); // A+B
  const [bothHands, setBothHands] = useState(false); // F
  const [ship, setShip] = useState({ x: 0.5, y: 0.5 }); // Space explorer

  // ---- camera + hand tracking ----------------------------------------------
  useEffect(() => {
    let cancelled = false;

    async function start() {
      try {
        const [landmarker, stream] = await Promise.all([
          getHandLandmarker(),
          startCameraStream(),
        ]);
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) return;
        await attachStream(video, stream);
        setReady(true);

        const loop = () => {
          if (cancelled || !videoRef.current) return;
          const v = videoRef.current;
          if (v.readyState >= 2) {
            const res = landmarker.detectForVideo(v, performance.now());
            const hands = (res.landmarks ?? []) as Hand[];
            const sides = (res.handedness ?? []).map(
              (h) => (h?.[0]?.categoryName ?? "Right") as Handedness
            );
            if (hands.length > 0) handleFrame(hands, sides);
          }
          rafRef.current = requestAnimationFrame(loop);
        };
        rafRef.current = requestAnimationFrame(loop);
      } catch {
        // camera unavailable — Rafiki still keeps things warm, never a fail state
        setMascotSays(t("cantSeeYouYet"));
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
    setMascotSays(t(CHEER_KEYS[Math.floor(Math.random() * CHEER_KEYS.length)] as any));
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
    setMascotSays(t(NUDGE_KEYS[Math.floor(Math.random() * NUDGE_KEYS.length)] as any));
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

  function handleFrame(hands: Hand[], sides: Handedness[]) {
    const hand = hands[0];
    const tol = staircase.current.value;

    // Hand position is always known, but the ring is only shown for the
    // mechanics where aiming is part of the movement being practised.
    const raw = palmCenter(hand);
    const pos = smoother.current.push({ x: 1 - raw.x, y: raw.y }); // mirror for selfie view
    const usesCursor =
      game.mechanic === "cursor" ||
      game.mechanic === "pinchDrag" ||
      game.mechanic === "scissor" ||
      game.mechanic === "pinch" ||
      game.mechanic === "reachTarget";
    if (usesCursor) setCursor(pos);
    else if (cursor) setCursor(null);

    switch (game.mechanic) {
      /* ── C — a real open → squeeze → hold cycle. A pinch cannot pass. ───── */
      case "fist": {
        const pct = fistClosePercent(hand);
        setSqueeze(pct);
        const needed = variant === "simplified" ? 55 : 75;
        if (fistCycle.current.update(hand, needed, variant === "simplified" ? 6 : 10)) {
          succeed(0.5, 0.4);
        }
        break;
      }

      /* ── A — pinch, and it must land on the firefly. A fist never counts. ─ */
      case "pinch": {
        if (pinchLatch.current.update(hand, tol)) {
          const near = nearestTarget(targets, pos);
          const reach = tol * 0.2 + 0.16;
          if (near && distance(near, pos) < reach) succeed(near.x, near.y);
          else if (near) drift(near.id);
        }
        break;
      }

      /* ── A + B — cursor position to grab, release over the home spot. ─── */
      case "pinchDrag": {
        const grabbed = pinchLatch.current.update(hand, tol);
        const held = pinchLatch.current.isHeld;
        if (grabbed && !carriedRef.current) {
          const near = nearestTarget(targets, pos);
          if (near && distance(near, pos) < 0.18) {
            carriedRef.current = near;
            setCarrying(true);
          }
        }
        if (carriedRef.current) {
          if (held) {
            setTargets((ts) =>
              ts.map((t) => (t.id === carriedRef.current?.id ? { ...t, x: pos.x, y: pos.y } : t))
            );
          } else {
            const home = { x: 0.5, y: 0.82 };
            const ok = distance(home, pos) < 0.18;
            const id = carriedRef.current.id;
            carriedRef.current = null;
            setCarrying(false);
            if (ok) succeed(home.x, home.y);
            else drift(id);
          }
        }
        break;
      }

      /* ── B — open hand held over the bubble. A closed fist does nothing. ── */
      case "cursor": {
        const near = nearestTarget(targets, pos);
        const open = isHandOpen(hand, variant === "simplified" ? 45 : 35);
        if (open && near && distance(near, pos) < tol * 0.2 + 0.1) {
          dwellRef.current += 1;
          if (dwellRef.current > (variant === "simplified" ? 8 : 14)) {
            dwellRef.current = 0;
            succeed(near.x, near.y);
          }
        } else {
          dwellRef.current = 0;
        }
        break;
      }

      /* ── D — the wrist must cross the midline AND reach the star. ───────── */
      case "crossMidline": {
        const crossed = hasCrossedMidline(hand, sides[0] ?? "Right", 0.5, 0.08);
        const near = nearestTarget(targets, pos);
        if (crossed && !crossRef.current) {
          crossRef.current = true;
          if (near && distance(near, pos) < (variant === "simplified" ? 0.32 : 0.24)) {
            succeed(near.x, near.y);
          } else if (near) {
            encourage();
          }
        } else if (!crossed) {
          crossRef.current = false;
        }
        break;
      }


      /* ── E — only the prompted finger counts, in order. ────────────────── */
      case "thumbSequence": {
        if (seqLatch.current.update(hand, nextFinger, tol)) {
          const steps = variant === "simplified" ? 2 : 4;
          const done = nextFinger + 1 >= steps;
          if (done) {
            setNextFinger(0);
            succeed();
          } else {
            setNextFinger((f) => ((f + 1) as 0 | 1 | 2 | 3));
            cheer();
          }
        }
        break;
      }

      /* ── F — both wrists held a steady distance apart, moving together. ─ */
      case "twoWrist": {
        if (hands.length < 2) {
          setBothHands(false);
          steadyRef.current = 0;
          break;
        }
        setBothHands(true);
        const spread = wristSpread(hands[0], hands[1]);
        const mid = wristMidpoint(hands[0], hands[1]);
        const center = { x: 1 - mid.x, y: mid.y };
        setCursor(center);
        const steady = isSpreadInRange(spread, 0.35, tol + 0.08);
        if (steady) {
          steadyRef.current += 1;
          const near = nearestTarget(targets, center);
          if (steadyRef.current > 10 && near && distance(near, center) < 0.2) {
            steadyRef.current = 0;
            succeed(near.x, near.y);
          }
        } else {
          steadyRef.current = 0;
        }
        break;
      }

      /* ── Magic garden / Balloon pop — reach the target zone with the hand. ─ */
      case "reachTarget": {
        const near = nearestTarget(targets, pos);
        const zone = tol + (variant === "simplified" ? 0.06 : 0);
        if (near && distance(near, pos) < zone) {
          dwellRef.current += 1;
          if (dwellRef.current > (variant === "simplified" ? 3 : 6)) {
            dwellRef.current = 0;
            succeed(near.x, near.y);
          }
        } else {
          dwellRef.current = 0;
        }
        break;
      }

      /* ── Space explorer — arm movement flies the rocket onto the planets. ─ */
      case "shipFly": {
        setShip(pos);
        const near = nearestTarget(targets, pos);
        const zone = tol + (variant === "simplified" ? 0.06 : 0);
        if (near && distance(near, pos) < zone) succeed(near.x, near.y);
        break;
      }

      /* ── special — scissor snip at the cursor position along the ribbon. ─ */
      case "scissor": {
        if (scissorCycle.current.update(hand, tol * 0.6)) {
          const near = nearestTarget(targets, pos);
          if (near && distance(near, pos) < 0.22) succeed(near.x, near.y);
          else if (near) drift(near.id);
        }
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
        <p className="mt-1 text-xs font-bold uppercase tracking-widest text-white/80">
          {t(HINT_KEYS[game.mechanic] as any)}
        </p>
      </div>

      {/* Mechanic D — a soft midline ribbon so the reach has somewhere to go */}
      {game.mechanic === "crossMidline" && (
        <div className="pointer-events-none absolute inset-y-0 left-1/2 z-10 w-1 -translate-x-1/2 bg-white/40" />
      )}

      {/* Mechanic C — the cloud squishes proportionally, no thresholds shown */}
      {game.mechanic === "fist" ? (
        <div
          className="pointer-events-none absolute left-1/2 top-2/5 z-10 select-none text-[8rem] transition-transform duration-100"
          style={{
            transform: `translate(-50%,-50%) scale(${1 - (squeeze / 100) * 0.55}, ${
              1 - (squeeze / 100) * 0.3
            })`,
          }}
        >
          ☁️
        </div>
      ) : (
        targets.map((t) => (
          <div
            key={t.id}
            className={`absolute z-10 select-none text-6xl transition-all duration-300 ${
              t.drifting ? "-translate-y-24 opacity-0" : "opacity-100"
            }`}
            style={{
              left: `${t.x * 100}%`,
              top: `${t.y * 100}%`,
              transform: "translate(-50%, -50%)",
            }}
          >
            {game.emoji}
          </div>
        ))
      )}

      {/* Mechanic A+B — the home spot to release into */}
      {game.mechanic === "pinchDrag" && (
        <div
          className={`pointer-events-none absolute bottom-[12%] left-1/2 z-10 h-24 w-24 -translate-x-1/2 rounded-3xl border-4 border-dashed ${
            carrying ? "border-white bg-white/30" : "border-white/60"
          }`}
        />
      )}

      {/* Mechanic E — which finger to touch next */}
      {game.mechanic === "thumbSequence" && (
        <div className="pointer-events-none absolute inset-x-0 top-24 z-20 text-center">
          <span className="rounded-full bg-white/90 px-5 py-2 font-display text-2xl text-emerald-900">
            Thumb ➜ {FINGER_NAMES[nextFinger]}
          </span>
        </div>
      )}

      {/* Mechanic F — gentle reminder both hands are needed */}
      {game.mechanic === "twoWrist" && !bothHands && (
        <div className="pointer-events-none absolute inset-x-0 top-24 z-20 text-center">
          <span className="rounded-full bg-white/90 px-5 py-2 font-display text-xl text-amber-900">
            Show Rafiki both hands 🙌
          </span>
        </div>
      )}

      {/* Space explorer — the rocket follows the arm */}
      {game.mechanic === "shipFly" && (
        <div
          className="pointer-events-none absolute z-20 select-none text-6xl transition-all duration-75"
          style={{
            left: `${ship.x * 100}%`,
            top: `${ship.y * 100}%`,
            transform: "translate(-50%, -50%)",
          }}
        >
          🚀
        </div>
      )}

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

      {/* hand cursor — only for the mechanics that are positional */}
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
          {ready ? mascotSays : t("rafikiWakingUp")}
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
            setNextFinger(0);
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
    flower: "🌸🌼",
    ship: "🚀🪐",
    balloon: "🎈🎉",
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
  const count =
    game.mechanic === "cursor"
      ? 3
      : game.mechanic === "fist"
        ? 0
        : game.mechanic === "pinch" || game.mechanic === "shipFly"
          ? 2
          : 1;
  const crossSide = Math.random() < 0.5 ? 0.16 : 0.84;
  // Reach games rotate through left / right / high / low / forward so the child
  // practises every reaching direction instead of one comfortable spot.
  const spots: { x: number; y: number }[] = [
    { x: 0.15, y: 0.5 },
    { x: 0.85, y: 0.5 },
    { x: 0.5, y: 0.14 },
    { x: 0.5, y: 0.72 },
    { x: 0.5, y: 0.42 },
    { x: 0.18, y: 0.2 },
    { x: 0.82, y: 0.2 },
  ];
  const reachy = game.mechanic === "reachTarget" || game.mechanic === "shipFly";
  return Array.from({ length: count }).map((_, i) => {
    const spot = spots[Math.floor(Math.random() * spots.length)];
    return {
      id: Date.now() + i + Math.floor(seed * 1000),
      x: game.mechanic === "crossMidline" ? crossSide : reachy ? spot.x : 0.2 + Math.random() * 0.6,
      y: reachy ? spot.y : 0.22 + Math.random() * 0.42,
      drifting: false,
    };
  });
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
