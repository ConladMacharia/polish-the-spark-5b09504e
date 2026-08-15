import { useState } from "react";

import {
  CHILD_GAMES,
  eligibilityFor,
  readMacsLevel,
  type ChildGame,
  type Eligibility,
} from "@/lib/child-games";
import { Rafiki } from "@/components/child/Rafiki";
import { ChildGameScreen } from "@/components/child/ChildGameScreen";

/**
 * Screen A — the world map. Unlocked games are islands; ineligible ones are
 * unlabeled mist (no locks, no levels, no numbers, no therapy language).
 */
export function RafikiIsland({ childName }: { childName?: string }) {
  const [macs] = useState(readMacsLevel);
  const [active, setActive] = useState<{ game: ChildGame; variant: Eligibility } | null>(null);

  const regions = CHILD_GAMES.map((game) => ({ game, variant: eligibilityFor(game, macs) }));

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
    <div className="min-h-screen bg-gradient-to-b from-sky-300 via-emerald-200 to-amber-100">
      <div className="mx-auto max-w-2xl px-5 pb-16 pt-8">
        <div className="text-center">
          <Rafiki size={120} />
          <h1 className="mt-3 font-display text-4xl text-emerald-900 drop-shadow">
            Rafiki&apos;s Island
          </h1>
          <p className="mt-1 font-display text-xl text-emerald-800/80">
            {childName ? `Come and play, ${childName.split(" ")[0]}!` : "Come and play!"}
          </p>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-4">
          {regions.map(({ game, variant }) =>
            variant === "mist" ? (
              <div
                key={game.id}
                aria-hidden
                className="h-36 rounded-[2rem] border-4 border-white/40 bg-white/40 backdrop-blur-md"
              >
                <div className="h-full w-full rounded-[1.7rem] bg-gradient-to-br from-white/70 to-slate-200/60" />
              </div>
            ) : (
              <button
                key={game.id}
                type="button"
                onClick={() => setActive({ game, variant })}
                className={`h-36 rounded-[2rem] border-4 border-white bg-gradient-to-br ${game.gradient} p-4 text-left text-white shadow-[0_6px_0_rgba(0,0,0,0.25)] transition-transform active:translate-y-1 active:shadow-[0_2px_0_rgba(0,0,0,0.25)]`}
              >
                <span className="text-4xl">{game.emoji}</span>
                <p className="mt-2 font-display text-xl leading-tight drop-shadow">
                  {game.region}
                </p>
                <p className="text-[11px] font-bold opacity-90">{game.invite}</p>
              </button>
            )
          )}
        </div>
      </div>
    </div>
  );
}
