// Rafiki's Island — game catalog, MACS gating and in-range difficulty staircase.

/**
 * One mechanic per game family — no two games share a detection path unless
 * they are explicitly the same engine (shape sorter / peg pop = pinchDrag).
 *  pinch         → Mechanic A alone (Firefly Catch, Zip the Tent)
 *  pinchDrag     → Mechanic A + B  (Shape Sorter, Peg Pop)
 *  cursor        → Mechanic B alone (Bubble Pop)
 *  fist          → Mechanic C alone (Squeeze the Cloud)
 *  crossMidline  → Mechanic D alone (Star Reach)
 *  thumbSequence → Mechanic E alone (Piano Keys)
 *  twoWrist      → Mechanic F alone (Carry the Basket)
 *  scissor       → special case + B (Snip the Ribbon)
 */
export type Mechanic =
  | "pinch"
  | "pinchDrag"
  | "cursor"
  | "fist"
  | "crossMidline"
  | "thumbSequence"
  | "twoWrist"
  | "scissor";

export type MacsLevel = 1 | 2 | 3 | 4 | 5;

export type DifficultyRange = {
  /** easiest end (floor) and hardest end (ceiling) of the therapist-set range */
  floor: number;
  ceiling: number;
};

export type ChildGame = {
  id: string;
  region: string;
  title: string;
  /** Child-facing invitation — never therapy language. */
  invite: string;
  emoji: string;
  mechanic: Mechanic;
  /** secondary skill, for therapist-facing notes only */
  skill: string;
  /** lowest MACS level where the full game is offered */
  fullUpTo: MacsLevel;
  /** lowest MACS level where a simplified variant is offered (optional) */
  simplifiedUpTo?: MacsLevel;
  /** number of successful rounds that completes a play session */
  roundsToReward: number;
  reward: "jar" | "constellation" | "tune" | "confetti" | "campsite" | "picture" | "pop" | "ribbon" | "basket" | "giggle";
  /** target size / tolerance range, meaning depends on mechanic */
  range: DifficultyRange;
  gradient: string;
};

export const CHILD_GAMES: ChildGame[] = [
  {
    id: "cloud-squeeze",
    region: "Cloud meadow",
    title: "Squeeze the cloud",
    invite: "Give the cloud a big squeeze",
    emoji: "☁️",
    mechanic: "fist",
    skill: "Gross grasp / warm-up",
    fullUpTo: 5,
    roundsToReward: 5,
    reward: "giggle",
    range: { floor: 0.95, ceiling: 0.6 },
    gradient: "from-sky-300 to-indigo-300",
  },
  {
    id: "firefly-catch",
    region: "Firefly marsh",
    title: "Firefly catch",
    invite: "Catch the fireflies in your jar",
    emoji: "✨",
    mechanic: "pinch",
    skill: "Pincer grasp",
    fullUpTo: 3,
    simplifiedUpTo: 4,
    roundsToReward: 6,
    reward: "jar",
    range: { floor: 0.85, ceiling: 0.35 },
    gradient: "from-emerald-400 to-teal-600",
  },
  {
    id: "star-reach",
    region: "Star sky path",
    title: "Star reach",
    invite: "Reach across for the twinkly stars",
    emoji: "⭐",
    mechanic: "crossMidline",
    skill: "Cross-midline reach",
    fullUpTo: 3,
    roundsToReward: 6,
    reward: "constellation",
    range: { floor: 0.9, ceiling: 0.5 },
    gradient: "from-indigo-500 to-purple-800",
  },
  {
    id: "piano-grove",
    region: "Piano grove",
    title: "Piano keys",
    invite: "Tap your fingers and play a tune",
    emoji: "🎹",
    mechanic: "thumbSequence",
    skill: "Isolated finger control",
    fullUpTo: 2,
    roundsToReward: 4,
    reward: "tune",
    range: { floor: 0.9, ceiling: 0.45 },
    gradient: "from-lime-400 to-emerald-600",
  },
  {
    id: "bubble-lagoon",
    region: "Bubble lagoon",
    title: "Bubble pop",
    invite: "Pop the bubbles with your hand",
    emoji: "🫧",
    mechanic: "cursor",
    skill: "Reach & placement",
    fullUpTo: 3,
    roundsToReward: 8,
    reward: "pop",
    range: { floor: 0.18, ceiling: 0.07 },
    gradient: "from-cyan-300 to-blue-500",
  },
  {
    id: "zip-tent",
    region: "Camp zipline hill",
    title: "Zip the tent",
    invite: "Pinch and pull up to zip the tent",
    emoji: "⛺",
    mechanic: "pinch",
    skill: "Pinch + vertical drag",
    fullUpTo: 3,
    simplifiedUpTo: 4,
    roundsToReward: 4,
    reward: "campsite",
    range: { floor: 0.85, ceiling: 0.4 },
    gradient: "from-amber-400 to-orange-600",
  },
  {
    id: "shape-sorter",
    region: "Puzzle temple",
    title: "Shape sorter",
    invite: "Carry each shape to its home",
    emoji: "🔷",
    mechanic: "pinch",
    skill: "Pinch, drag & release",
    fullUpTo: 3,
    simplifiedUpTo: 4,
    roundsToReward: 5,
    reward: "picture",
    range: { floor: 0.2, ceiling: 0.09 },
    gradient: "from-rose-400 to-pink-600",
  },
  {
    id: "peg-pop",
    region: "Puzzle temple",
    title: "Peg pop",
    invite: "Pop the pegs into their holes",
    emoji: "🟡",
    mechanic: "pinch",
    skill: "Pinch, drag & release",
    fullUpTo: 3,
    simplifiedUpTo: 4,
    roundsToReward: 5,
    reward: "pop",
    range: { floor: 0.2, ceiling: 0.09 },
    gradient: "from-fuchsia-400 to-violet-600",
  },
  {
    id: "snip-ribbon",
    region: "Ribbon carnival",
    title: "Snip the ribbon",
    invite: "Snip along the shiny ribbon",
    emoji: "🎀",
    mechanic: "cursor",
    skill: "Scissor finger motion",
    fullUpTo: 2,
    roundsToReward: 5,
    reward: "ribbon",
    range: { floor: 0.9, ceiling: 0.5 },
    gradient: "from-red-400 to-rose-600",
  },
  {
    id: "carry-basket",
    region: "Basket trail",
    title: "Carry the basket",
    invite: "Carry the basket down the path",
    emoji: "🧺",
    mechanic: "twoWrist",
    skill: "Bimanual coordination",
    fullUpTo: 2,
    simplifiedUpTo: 3,
    roundsToReward: 5,
    reward: "basket",
    range: { floor: 0.16, ceiling: 0.07 },
    gradient: "from-yellow-400 to-amber-600",
  },
];

export type Eligibility = "full" | "simplified" | "mist";

export function eligibilityFor(game: ChildGame, macs: MacsLevel): Eligibility {
  if (macs <= game.fullUpTo) return "full";
  if (game.simplifiedUpTo && macs <= game.simplifiedUpTo) return "simplified";
  return "mist";
}

/**
 * Staircase difficulty controller. `value` walks between range.floor (easiest)
 * and range.ceiling (hardest) and never leaves that therapist-set range.
 */
export class Staircase {
  private history: boolean[] = [];
  value: number;

  constructor(
    private range: DifficultyRange,
    private simplified = false
  ) {
    // start near the easy end, a little easier still when simplified
    this.value = simplified ? range.floor : range.floor + (range.ceiling - range.floor) * 0.25;
  }

  private clamp(v: number) {
    const lo = Math.min(this.range.floor, this.range.ceiling);
    const hi = Math.max(this.range.floor, this.range.ceiling);
    return Math.min(hi, Math.max(lo, v));
  }

  record(success: boolean) {
    this.history.push(success);
    if (this.history.length > 8) this.history.shift();
    const tail = this.history.slice(-3);
    const step = (this.range.ceiling - this.range.floor) * 0.12;
    if (tail.length >= 3 && tail.every(Boolean)) {
      this.value = this.clamp(this.value + step);
      this.history = [];
    } else if (this.history.slice(-2).length === 2 && this.history.slice(-2).every((h) => !h)) {
      this.value = this.clamp(this.value - step);
      this.history = [];
    }
  }

  /** Therapist-facing signals — never shown to the child. */
  get signal(): "plateau-easing" | "at-ceiling" | "ok" {
    const misses = this.history.filter((h) => !h).length;
    if (this.history.length >= 6 && misses >= 4) return "plateau-easing";
    if (Math.abs(this.value - this.range.ceiling) < 1e-6 && this.history.filter(Boolean).length >= 5)
      return "at-ceiling";
    return "ok";
  }
}

const MACS_KEY = "nb.child.macs";

export function readMacsLevel(): MacsLevel {
  if (typeof window === "undefined") return 2;
  const raw = Number(window.localStorage.getItem(MACS_KEY));
  return raw >= 1 && raw <= 5 ? (raw as MacsLevel) : 2;
}

export function writeMacsLevel(level: MacsLevel) {
  if (typeof window !== "undefined") window.localStorage.setItem(MACS_KEY, String(level));
}
