import { useEffect, useState } from "react";
import {
  Bug,
  Circle,
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
import { warmUpHandLandmarker } from "@/lib/pose/handLandmarker";
import { Rafiki } from "@/components/child/Rafiki";
import { ChildGameScreen } from "@/components/child/ChildGameScreen";
import { PianoGroveGame } from "@/components/PianoGroveGame";
import { SpaceExplorerGame } from "@/components/SpaceExplorerGame";
import { CampZiplineGame } from "@/components/CampZiplineGame";
import { BalloonFairGame } from "@/components/BalloonFairGame";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { AmbientBlobs, GlassCard } from "@/components/ui/glass";

/** Converts a game id ("cloud-squeeze") into the camelCase suffix used by
 *  the gameRegion_/gameTitle_/gameInvite_/gameCaption_ translation keys. */
function gameKeySuffix(id: string) {
  return id.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
}

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  "cloud-squeeze": Cloud,
  "firefly-catch": Bug,
  "star-reach": Sparkles,
  "piano-grove": Music4,
  "bubble-lagoon": Droplet,
  "zip-tent": Tent,
  "shape-sorter": Puzzle,
  "peg-pop": Circle,
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

/** Full-screen shell around a camera game, with a way back to the map. */
function GameFrame({
  title,
  onExit,
  children,
}: {
  title: string;
  onExit: () => void;
  children: React.ReactNode;
}) {
  const { t } = useLanguage();
  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-emerald-950 via-[#05100c] to-emerald-950">
      <AmbientBlobs />
      <div className="relative z-10 mx-auto flex max-w-3xl flex-col items-center gap-4 px-5 py-6">
        <div className="flex w-full items-center justify-between">
          <h1 className="font-display text-xl font-extrabold text-stone-50">{title}</h1>
          <button
            type="button"
            onClick={onExit}
            className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-stone-200 backdrop-blur-xl transition-colors hover:bg-white/15"
          >
            {t("backToIsland")}
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function macsLabel(games: ChildGame[], t: (key: any, vars?: Record<string, string | number>) => string) {
  const full = Math.max(...games.map((g) => g.fullUpTo));
  const simplified = Math.max(...games.map((g) => g.simplifiedUpTo ?? 0));
  if (full >= 5) return { text: t("allMacsLevels"), tone: "ok" as const };
  const base = t("macsRange", { roman: ROMAN[full] });
  if (simplified > full)
    return {
      text: t("macsRangeSimplified", { base, roman: ROMAN[simplified] }),
      tone: "info" as const,
    };
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
  // Fixed opening run, then the remaining regions in catalogue order.
  const preferred = ["Cloud meadow", "Camp zipline hill", "Balloon fair", "Star harbour", "Piano grove"];
  order.sort((a, b) => {
    const ia = preferred.indexOf(a);
    const ib = preferred.indexOf(b);
    return (ia === -1 ? preferred.length : ia) - (ib === -1 ? preferred.length : ib);
  });
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
  const { t } = useLanguage();
  const [macs] = useState(readMacsLevel);
  const [active, setActive] = useState<{ game: ChildGame; variant: Eligibility } | null>(null);

  // Preload the hand-tracking runtime + model while the child browses the map,
  // so opening a game starts detecting immediately.
  useEffect(() => {
    warmUpHandLandmarker();
  }, []);

  const regions = buildRegions(macs);

  function gameTitle(game: ChildGame) {
    return t(`gameTitle_${gameKeySuffix(game.id)}` as any) || game.title;
  }

  if (active) {
    if (active.game.id === "piano-grove") {
      return <PianoGroveGame onExit={() => setActive(null)} />;
    }
    if (active.game.id === "space-explorer") {
      return (
        <GameFrame title={gameTitle(active.game)} onExit={() => setActive(null)}>
          <SpaceExplorerGame />
        </GameFrame>
      );
    }
    if (active.game.id === "balloon-pop") {
      return (
        <GameFrame title={gameTitle(active.game)} onExit={() => setActive(null)}>
          <BalloonFairGame bowHand="left" />
        </GameFrame>
      );
    }
    if (active.game.id === "zip-tent") {
      return (
        <GameFrame title={gameTitle(active.game)} onExit={() => setActive(null)}>
          <CampZiplineGame />
        </GameFrame>
      );
    }
    return (
      <ChildGameScreen
        game={active.game}
        variant={active.variant}
        onExit={() => setActive(null)}
      />
    );
  }


  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-emerald-950 via-[#05100c] to-emerald-950">
      <AmbientBlobs />
      <div className="relative z-10 mx-auto max-w-5xl px-5 pb-24 pt-8">
        <header className="flex flex-wrap items-end justify-between gap-3 border-b border-white/10 pb-5">
          <div className="flex items-center gap-3">
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-emerald-300 to-emerald-500 shadow-lg shadow-emerald-500/30">
              <Rafiki size={40} />
            </div>
            <div>
              <h1 className="font-playful text-2xl font-extrabold tracking-tight text-stone-50">
                {t("worldMapTitle")}
              </h1>
              <p className="text-sm font-medium text-stone-300">
                {childName
                  ? t("comeAndPlayNamed", { name: childName.split(" ")[0] })
                  : t("comeAndPlay")}
              </p>
            </div>
          </div>
          <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[12px] font-semibold text-emerald-200 backdrop-blur-xl">
            {t("gatedByMacs")}
          </span>
        </header>

        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {regions.map(({ region, games, playable }, i) => {
            const chip = macsLabel(games, t);
            const regionLabel =
              t(`gameRegion_${gameKeySuffix(games[0].id)}` as any) || region;
            const title = games.map((g) => gameTitle(g)).join(" + ");
            const caption =
              t(`gameCaption_${gameKeySuffix(games[0].id)}` as any) ||
              MECHANIC_CAPTION[games[0].id] ||
              games[0].skill;
            const locked = !playable;

            return (
              <li key={region}>
                <GlassCard
                  as="button"
                  tint={locked ? "dark" : i % 2 === 0 ? "emerald" : "neutral"}
                  disabled={locked}
                  className={`w-full p-4 text-left transition-transform ${
                    locked ? "cursor-not-allowed opacity-50" : "active:scale-[0.98]"
                  }`}
                  onClick={() => playable && setActive(playable)}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="flex items-center gap-1.5">
                      {games.map((g) => {
                        const GameIcon = ICONS[g.id] ?? Sparkles;
                        return <GameIcon key={g.id} className="h-5 w-5 text-emerald-300" />;
                      })}
                    </span>
                    <h2 className="font-playful text-base font-bold text-stone-50">{regionLabel}</h2>
                  </div>
                  <p className="mt-2 text-[13px] leading-snug text-stone-300">
                    {title} — {caption}
                  </p>
                  <p
                    className={`mt-2 text-[12.5px] font-semibold ${
                      chip.tone === "ok"
                        ? "text-emerald-300"
                        : chip.tone === "warn"
                          ? "text-amber-300"
                          : "text-emerald-200"
                    }`}
                  >
                    {chip.text}
                  </p>
                </GlassCard>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
