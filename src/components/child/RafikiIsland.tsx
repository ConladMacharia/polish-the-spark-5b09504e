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
 * Screen A — the world map. Regions sit along a winding island trail; the ones
 * this child isn't eligible for stay unlabeled mist (no locks, no levels, no
 * numbers, no therapy language).
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
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-sky-300 via-emerald-200 to-amber-100">
      {/* soft sky + sea decoration */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-[radial-gradient(circle_at_20%_10%,rgba(255,255,255,0.85),transparent_60%)]" />

      <div className="relative mx-auto max-w-md px-5 pb-24 pt-8">
        <div className="text-center">
          <Rafiki size={120} />
          <h1 className="mt-3 font-display text-4xl text-emerald-900 drop-shadow">
            Rafiki&apos;s Island
          </h1>
          <p className="mt-1 font-display text-xl text-emerald-800/80">
            {childName ? `Come and play, ${childName.split(" ")[0]}!` : "Come and play!"}
          </p>
        </div>

        {/* the trail */}
        <div className="relative mt-10">
          <div className="absolute bottom-8 left-1/2 top-8 w-6 -translate-x-1/2 rounded-full bg-amber-200/70 [background-image:repeating-linear-gradient(180deg,rgba(255,255,255,0.9)_0_10px,transparent_10px_26px)]" />

          <ul className="relative space-y-6">
            {regions.map(({ game, variant }, i) => {
              const left = i % 2 === 0;
              return (
                <li
                  key={game.id}
                  className={`flex ${left ? "justify-start" : "justify-end"}`}
                >
                  {variant === "mist" ? (
                    <div
                      aria-hidden
                      className="h-28 w-[58%] rounded-[2rem] border-4 border-white/50 bg-white/50 backdrop-blur-md"
                    >
                      <div className="h-full w-full rounded-[1.6rem] bg-gradient-to-br from-white/80 to-slate-200/60" />
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setActive({ game, variant })}
                      className={`w-[62%] rounded-[2rem] border-4 border-white bg-gradient-to-br ${game.gradient} p-4 text-left text-white shadow-[0_6px_0_rgba(0,0,0,0.25)] transition-transform active:translate-y-1 active:shadow-[0_2px_0_rgba(0,0,0,0.25)]`}
                    >
                      <span className="text-4xl drop-shadow">{game.emoji}</span>
                      <p className="mt-1 font-display text-xl leading-tight drop-shadow">
                        {game.region}
                      </p>
                      <p className="text-[11px] font-bold opacity-90">{game.invite}</p>
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
