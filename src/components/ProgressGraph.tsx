import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchChildExerciseTargets } from "@/lib/exercise-targets.data";
import {
  getEffectiveTarget,
  getDefaultConfig,
  resolveTargetSlug,
  type ChildExerciseTargetOverride,
} from "@/lib/exercise-targets";

interface Sample {
  t: number;
  angle: number | null;
}

interface ProgressGraphProps {
  childId?: string;
  /** Optional: pin the graph to one exercise slug. */
  exercise?: string;
  /** Optional: live samples from an in-progress session (plotted as today). */
  liveHistory?: Sample[];
  /** Optional: override the therapist target line. */
  targetAngle?: number | null;
}

interface SessionRow {
  started_at: string;
  exercise_slug: string | null;
  side: string | null;
  best_angle_deg: number | null;
  avg_range_of_motion_deg: number | null;
}

type Side = "left" | "right";

function dayKey(ts: number) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function dayLabel(key: string) {
  const [, m, d] = key.split("-");
  return `${Number(m)}/${Number(d)}`;
}

export default function ProgressGraph({
  childId,
  exercise,
  liveHistory,
  targetAngle,
}: ProgressGraphProps) {
  const [rows, setRows] = useState<SessionRow[]>([]);
  const [overrides, setOverrides] = useState<ChildExerciseTargetOverride[]>([]);
  const [loading, setLoading] = useState(true);
  const [slug, setSlug] = useState<string | null>(exercise ? resolveTargetSlug(exercise) : null);
  const [side, setSide] = useState<Side | null>(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      if (!childId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("sessions")
          .select("started_at,exercise_slug,side,best_angle_deg,avg_range_of_motion_deg")
          .eq("patient_id", childId)
          .order("started_at", { ascending: true })
          .limit(500);
        if (error) throw error;
        if (!mounted) return;
        const list = (data ?? []) as SessionRow[];
        setRows(list);

        if (!exercise) {
          const latest = [...list].reverse().find((r) => r.exercise_slug);
          if (latest?.exercise_slug) {
            setSlug(resolveTargetSlug(latest.exercise_slug));
            setSide((latest.side as Side | null) ?? null);
          }
        }

        try {
          const fetched = await fetchChildExerciseTargets(childId);
          if (mounted) setOverrides(fetched);
        } catch (e) {
          console.warn("Failed to fetch child exercise targets", e);
        }
      } catch (e) {
        console.error("ProgressGraph load error", e);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [childId, exercise]);

  /* which exercises this child actually has data for */
  const exerciseOptions = useMemo(() => {
    const seen = new Map<string, string>();
    rows.forEach((r) => {
      if (!r.exercise_slug) return;
      const canonical = resolveTargetSlug(r.exercise_slug);
      if (!seen.has(canonical)) {
        seen.set(canonical, getDefaultConfig(canonical)?.name ?? canonical);
      }
    });
    return [...seen.entries()].map(([value, label]) => ({ value, label }));
  }, [rows]);

  const sideOptions = useMemo(() => {
    const set = new Set<Side>();
    rows.forEach((r) => {
      if (!slug || resolveTargetSlug(r.exercise_slug ?? "") !== slug) return;
      if (r.side === "left" || r.side === "right") set.add(r.side);
    });
    return [...set];
  }, [rows, slug]);

  /* therapist target for this child + exercise (+ side) */
  const target = useMemo(() => {
    if (targetAngle != null) return targetAngle;
    if (!slug || !childId) return null;
    const eff =
      getEffectiveTarget(slug, overrides, childId, side ?? undefined) ??
      getEffectiveTarget(slug, overrides, childId);
    return eff?.angle?.primary ?? null;
  }, [slug, side, overrides, childId, targetAngle]);

  const targetSource = useMemo(() => {
    if (!slug || !childId) return null;
    const eff =
      getEffectiveTarget(slug, overrides, childId, side ?? undefined) ??
      getEffectiveTarget(slug, overrides, childId);
    return eff?.source ?? null;
  }, [slug, side, overrides, childId]);

  /* best angle per calendar day */
  const days = useMemo(() => {
    const best = new Map<string, number>();

    rows.forEach((r) => {
      if (slug && resolveTargetSlug(r.exercise_slug ?? "") !== slug) return;
      if (side && r.side && r.side !== side) return;
      const value = r.best_angle_deg ?? r.avg_range_of_motion_deg;
      if (value == null) return;
      const key = dayKey(new Date(r.started_at).getTime());
      best.set(key, Math.max(best.get(key) ?? 0, value));
    });

    const live = (liveHistory ?? [])
      .map((s) => s.angle)
      .filter((a): a is number => a != null && Number.isFinite(a));
    if (live.length) {
      const key = dayKey(Date.now());
      best.set(key, Math.max(best.get(key) ?? 0, Math.round(Math.max(...live))));
    }

    return [...best.entries()]
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .map(([key, angle]) => ({ key, angle }));
  }, [rows, slug, side, liveHistory]);

  if (loading) {
    return (
      <div className="py-8 text-center text-sm font-semibold text-slate-500">
        Loading progress…
      </div>
    );
  }

  const picker = (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      {exerciseOptions.length > 1 && (
        <select
          value={slug ?? ""}
          onChange={(e) => {
            setSlug(e.target.value || null);
            setSide(null);
          }}
          className="rounded-xl border-2 border-slate-900 bg-amber-50 px-3 py-1.5 text-xs font-extrabold text-slate-900"
        >
          {exerciseOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}
      {sideOptions.length > 0 && (
        <div className="inline-flex overflow-hidden rounded-xl border-2 border-slate-900">
          <button
            type="button"
            onClick={() => setSide(null)}
            className={`px-3 py-1.5 text-xs font-extrabold ${side === null ? "bg-slate-900 text-white" : "bg-amber-50 text-slate-900"}`}
          >
            Both
          </button>
          {sideOptions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSide(s)}
              className={`border-l-2 border-slate-900 px-3 py-1.5 text-xs font-extrabold capitalize ${side === s ? "bg-slate-900 text-white" : "bg-amber-50 text-slate-900"}`}
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  if (days.length === 0) {
    return (
      <div>
        {exerciseOptions.length > 0 && picker}
        <div className="rounded-2xl border-2 border-dashed border-slate-400 bg-amber-50 p-6 text-center">
          <p className="font-display text-base font-bold text-slate-900">No progress yet</p>
          <p className="mt-1 text-xs font-semibold text-slate-600">
            Finish a tracked exercise in the library and the angle reached will appear here, day by
            day.
          </p>
        </div>
      </div>
    );
  }

  /* ── chart geometry ── */
  const width = 620;
  const height = 220;
  const padL = 42;
  const padR = 16;
  const padT = 18;
  const padB = 34;

  const bestEver = Math.max(...days.map((d) => d.angle));
  const yMax = Math.max(target ?? 0, bestEver, 10);
  const yMin = 0;

  const xFor = (i: number) =>
    padL + (days.length === 1 ? (width - padL - padR) / 2 : (i / (days.length - 1)) * (width - padL - padR));
  const yFor = (a: number) =>
    height - padB - ((a - yMin) / (yMax - yMin || 1)) * (height - padT - padB);

  const linePath = days.map((d, i) => `${i === 0 ? "M" : "L"} ${xFor(i)} ${yFor(d.angle)}`).join(" ");

  const latest = days[days.length - 1];
  const previous = days.length > 1 ? days[days.length - 2] : null;
  const delta = previous ? Math.round(latest.angle - previous.angle) : null;
  const gap = target != null ? Math.round(target - latest.angle) : null;

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((p) => Math.round(yMin + p * (yMax - yMin)));

  return (
    <div>
      {exerciseOptions.length > 0 && picker}

      <div className="overflow-x-auto">
        <svg width={width} height={height} role="img" aria-label="Angle achieved per day" className="block">
          {ticks.map((v) => (
            <g key={v}>
              <line x1={padL} x2={width - padR} y1={yFor(v)} y2={yFor(v)} stroke="currentColor" className="text-slate-200" />
              <text x={padL - 8} y={yFor(v) + 4} textAnchor="end" className="fill-slate-500" style={{ fontSize: 10, fontWeight: 700 }}>
                {v}°
              </text>
            </g>
          ))}

          {target != null && (
            <>
              <line
                x1={padL}
                x2={width - padR}
                y1={yFor(target)}
                y2={yFor(target)}
                stroke="#e11d48"
                strokeWidth={2}
                strokeDasharray="6 5"
              />
              <text x={width - padR} y={yFor(target) - 6} textAnchor="end" className="fill-rose-600" style={{ fontSize: 10, fontWeight: 800 }}>
                Target {target}°
              </text>
            </>
          )}

          {linePath && <path d={linePath} fill="none" stroke="#2563eb" strokeWidth={3} strokeLinejoin="round" />}

          {days.map((d, i) => (
            <g key={d.key}>
              <circle cx={xFor(i)} cy={yFor(d.angle)} r={4.5} fill="#2563eb" stroke="#fff" strokeWidth={2} />
              <text x={xFor(i)} y={yFor(d.angle) - 10} textAnchor="middle" className="fill-slate-700" style={{ fontSize: 10, fontWeight: 800 }}>
                {Math.round(d.angle)}°
              </text>
              <text x={xFor(i)} y={height - padB + 16} textAnchor="middle" className="fill-slate-500" style={{ fontSize: 10, fontWeight: 700 }}>
                {dayLabel(d.key)}
              </text>
            </g>
          ))}

          <text x={width / 2} y={height - 4} textAnchor="middle" className="fill-slate-400" style={{ fontSize: 10, fontWeight: 700 }}>
            Day
          </text>
        </svg>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <div className="rounded-xl border-2 border-slate-900 bg-amber-50 p-2.5 text-center">
          <p className="font-display text-xl font-bold text-slate-900">{Math.round(latest.angle)}°</p>
          <p className="text-[10px] font-extrabold uppercase text-slate-500">Latest best</p>
        </div>
        <div className="rounded-xl border-2 border-slate-900 bg-amber-50 p-2.5 text-center">
          <p
            className={`font-display text-xl font-bold ${delta == null ? "text-slate-400" : delta >= 0 ? "text-emerald-600" : "text-rose-600"}`}
          >
            {delta == null ? "—" : `${delta > 0 ? "+" : ""}${delta}°`}
          </p>
          <p className="text-[10px] font-extrabold uppercase text-slate-500">Since last time</p>
        </div>
        <div className="rounded-xl border-2 border-slate-900 bg-amber-50 p-2.5 text-center">
          <p className="font-display text-xl font-bold text-slate-900">
            {gap == null ? "—" : gap <= 0 ? "Reached" : `${gap}°`}
          </p>
          <p className="text-[10px] font-extrabold uppercase text-slate-500">
            {gap != null && gap <= 0 ? "Target" : "To target"}
          </p>
        </div>
      </div>

      {target != null && (
        <p className="mt-2 text-[11px] font-semibold text-slate-500">
          {targetSource === "custom"
            ? "Target set by your child's therapist."
            : "Using the standard clinical target until the therapist sets one."}
        </p>
      )}
    </div>
  );
}
