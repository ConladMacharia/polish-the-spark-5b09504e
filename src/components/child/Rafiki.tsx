/** Rafiki — the one mascot who appears across every game on the island. */
export function Rafiki({
  mood = "idle",
  size = 120,
}: {
  mood?: "idle" | "cheer" | "encourage";
  size?: number;
}) {
  const animation =
    mood === "cheer" ? "animate-bounce" : mood === "encourage" ? "animate-pulse" : "";
  return (
    <div
      className={`mx-auto grid place-items-center rounded-full border-4 border-white bg-gradient-to-br from-amber-300 to-orange-500 shadow-xl ${animation}`}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <span style={{ fontSize: size * 0.5 }}>{mood === "cheer" ? "🥳" : "🦁"}</span>
    </div>
  );
}
