import { useState } from "react";
import {
  Bug,
  Cloud,
  Droplet,
  Flower2,
  Music4,
  PartyPopper,
  Puzzle,
  Rocket,
  Scissors,
  ShoppingBasket,
  Sparkles,
  Tent,
} from "lucide-react";

import {
  CHILD_GAMES,
  eligibilityFor,
  readMacsLevel,
  type ChildGame,
  type Eligibility,
  type MacsLevel,
} from "@/lib/child-games";
import { Rafiki } from "@/components/child/Rafiki";
import { ChildGameScreen } from "@/components/child/ChildGameScreen";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  "cloud-squeeze": Cloud,
  "firefly-catch": Bug,
  "star-reach": Sparkles,
  "piano-grove": Music4,
  "bubble-lagoon": Droplet,
  "zip-tent": Tent,
  "shape-sorter": Puzzle,
  "peg-pop": Puzzle,
  "snip-ribbon": Scissors,
  "carry-basket": ShoppingBasket,
  "magic-garden": Flower2,
  "space-explorer": Rocket,
  "balloon-pop": PartyPopper,
};

/** Short mechanic caption, therapist-facing wording used on the map cards. */
const MECHANIC_CAPTION: Record<string, string> = {
  "cloud-squeeze": "warm-up, no fail state",
  "firefly-catch": "pinch to grab",
  "star-reach": "cross the midline",
  "piano-grove": "finger sequencing",
  "bubble-lagoon": "hand-eye reach",
  "zip-tent": "pinch + drag",
  "shape-sorter": "same engine",
  "peg-pop": "same engine",
  "snip-ribbon": "two-finger snip",
  "carry-basket": "two-hand symmetry",
  "magic-garden": "multi-direction reach",
  "space-explorer": "whole-arm range",
  "balloon-pop": "overhead & cross-body reach",
};

const ROMAN = ["", "I", "II", "III", "IV", "V"];

function macsLabel(games: ChildGame[]) {
  const full = Math.max(...games.map((g) => g.fullUpTo));
  const simplified = Math.max(...games.map((g) => g.simplifiedUpTo ?? 0));
  if (full >= 5) return { text: "All MACS levels", tone: "ok" as const };
  const base = `MACS I–${ROMAN[full]}`;
  if (simplified > full)
    return { text: `${base} · ${ROMAN[simplified]} simplified`, tone: "info" as const };
  return { text: base, tone: full <= 2 ? ("warn" as const) : ("info" as const) };
}

type Region = {
  region: string;
  games: ChildGame[];
  playable: { game: ChildGame; variant: Eligibility } | null;
};

function buildRegions(macs: MacsLevel): Region[] {
  const order: string[] = [];
  const byRegion = new Map<string, ChildGame[]>();
  for (const game of CHILD_GAMES) {
    if (!byRegion.has(game.region)) {
      byRegion.set(game.region, []);
      order.push(game.region);
    }
    byRegion.get(game.region)!.push(game);
  }
  return order.map((region) => {
    const games = byRegion.get(region)!;
    const openable = games
      .map((game) => ({ game, variant: eligibilityFor(game, macs) }))
      .find(({ variant }) => variant !== "mist");
    return { region, games, playable: openable ?? null };
  });
}

/**
 * Screen A — the world map, laid out as a calm card grid: one card per island
 * region, its activity and mechanic, and the MACS gating chip.
 */
export function RafikiIsland({ childName }: { childName?: string }) {
  const [macs] = useState(readMacsLevel);
  const [active, setActive] = useState<{ game: ChildGame; variant: Eligibility } | null>(null);

  const regions = buildRegions(macs);

  if (active) {
    return (
      <ChildGameScreen
        game={active.game}
        variant={active.variant}
        onExit={() => setActive(null)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-5xl px-5 pb-24 pt-8">
        <header className="flex flex-wrap items-end justify-between gap-3 border-b border-border pb-5">
          <div className="flex items-center gap-3">
            <Rafiki size={56} />
            <div>
              <h1 className="font-display text-2xl font-extrabold tracking-tight text-foreground">
                Rafiki&apos;s island — world map
              </h1>
              <p className="text-sm text-muted-foreground">
                {childName ? `Come and play, ${childName.split(" ")[0]}!` : "Come and play!"}
              </p>
            </div>
          </div>
          <span className="text-sm text-muted-foreground">Gated by MACS level</span>
        </header>

        <ul className="mt-8 grid gap-x-10 gap-y-9 sm:grid-cols-2 lg:grid-cols-3">
          {regions.map(({ region, games, playable }) => {
            const Icon = ICONS[games[0].id] ?? Sparkles;
            const chip = macsLabel(games);
            const title = games.map((g) => g.title).join(" + ");
            const caption = MECHANIC_CAPTION[games[0].id] ?? games[0].skill;
            const locked = !playable;

            return (
              <li key={region}>
                <button
                  type="button"
                  disabled={locked}
                  onClick={() => playable && setActive(playable)}
                  className={`group w-full rounded-2xl border border-transparent p-3 text-left transition-colors ${
                    locked
                      ? "cursor-not-allowed opacity-45"
                      : "hover:border-border hover:bg-muted/50"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className="h-6 w-6 text-primary" />
                    <h2 className="text-lg font-semibold text-muted-foreground group-hover:text-foreground">
                      {region}
                    </h2>
                  </div>
                  <p className="mt-2 text-base leading-snug text-foreground/85">
                    {title} — {caption}
                  </p>
                  <p
                    className={`mt-2 text-sm font-medium ${
                      chip.tone === "ok"
                        ? "text-emerald-600"
                        : chip.tone === "warn"
                          ? "text-amber-600"
                          : "text-primary"
                    }`}
                  >
                    {chip.text}
                  </p>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
