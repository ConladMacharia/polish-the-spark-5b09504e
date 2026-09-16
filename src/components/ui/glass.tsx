import type { ReactNode } from "react";

/**
 * Shared "translucent forest glass" design primitives.
 *
 * Base: deep emerald canvas + soft blurred color blobs behind everything.
 * Caregiver and child views intentionally share this exact palette — the
 * two audiences are told apart by typography and touch-target scale, not
 * by a competing color scheme (see ChildGameScreen / RafikiIsland).
 */

const TINTS = {
  neutral: "bg-white/[0.08] border-white/15",
  emerald:
    "bg-gradient-to-br from-emerald-300/25 via-emerald-500/10 to-white/[0.05] border-emerald-200/20",
  dark: "bg-black/30 border-white/10",
} as const;

export type GlassTint = keyof typeof TINTS;

export function GlassCard({
  className = "",
  tint = "neutral",
  as: Comp = "div",
  onClick,
  children,
}: {
  className?: string;
  tint?: GlassTint;
  as?: "div" | "button";
  onClick?: () => void;
  children: ReactNode;
}) {
  return (
    <Comp
      onClick={onClick}
      type={Comp === "button" ? "button" : undefined}
      className={`relative overflow-hidden rounded-3xl border backdrop-blur-2xl shadow-lg shadow-black/30 ${TINTS[tint]} ${className}`}
    >
      {/* faint top sheen so the glass reads as curved/lit, not a flat tint */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/10 to-transparent" />
      <div className="relative">{children}</div>
    </Comp>
  );
}

/** Soft, blurred color fields anchored to the corners of their container.
 *  Kept low-opacity and edge-anchored so they never wash out content
 *  sitting on top — just give the glass panels something to refract. */
export function AmbientBlobs() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute -left-20 -top-16 h-56 w-56 rounded-full bg-emerald-400/15 blur-[100px]" />
      <div className="absolute -right-24 top-1/4 h-64 w-64 rounded-full bg-teal-500/10 blur-[110px]" />
      <div className="absolute -bottom-24 -right-16 h-64 w-64 rounded-full bg-emerald-600/15 blur-[110px]" />
    </div>
  );
}

/** Small uppercase section label used above form fields / groups. */
export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-300">{children}</p>
  );
}

/** Tappable pill used for single-select chip groups (CP type, side
 *  affected, mobility, language, filters, ...). */
export function Chip({
  active,
  onClick,
  children,
  className = "",
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3.5 py-1.5 text-[12px] font-semibold backdrop-blur-xl transition-colors ${
        active
          ? "border-emerald-200/30 bg-gradient-to-br from-emerald-300/30 to-emerald-500/10 text-emerald-100"
          : "border-white/15 bg-white/10 text-stone-300"
      } ${className}`}
    >
      {children}
    </button>
  );
}

/** Solid (non-glass, intentionally opaque) bottom navigation bar shell.
 *  Kept solid rather than translucent so it stays legible over any
 *  content/blob combination scrolling behind it. */
export function BottomNav<T extends string>({
  items,
  active,
  onChange,
}: {
  items: { id: T; icon: React.ComponentType<{ className?: string }>; label: string }[];
  active: T;
  onChange: (id: T) => void;
}) {
  return (
    <div className="relative z-10 mx-4 mb-4 flex justify-between rounded-3xl border border-white/10 bg-emerald-900 px-3 py-3 shadow-lg shadow-black/30">
      {items.map((it) => {
        const Icon = it.icon;
        const isActive = active === it.id;
        return (
          <button
            key={it.id}
            type="button"
            onClick={() => onChange(it.id)}
            className="flex flex-1 flex-col items-center gap-1"
          >
            <Icon className={`h-5 w-5 ${isActive ? "text-emerald-300" : "text-stone-400"}`} />
            <span className={`text-[10px] font-medium ${isActive ? "text-emerald-300" : "text-stone-400"}`}>
              {it.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
