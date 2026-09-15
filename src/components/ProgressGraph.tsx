import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useExerciseTarget } from "./ExerciseTargetDisplay";
import { fetchChildExerciseTargets } from "@/lib/exercise-targets.data";

interface Sample {
  t: number;
  angle: number | null;
}

interface ProgressGraphProps {
  childId?: string;
  exercise?: string;
  liveHistory?: Sample[];
  targetAngle?: number | null;
}

function formatDateShort(ts: number) {
  const d = new Date(ts);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export default function ProgressGraph({ childId, exercise, liveHistory, targetAngle }: ProgressGraphProps) {
  const [pastPoints, setPastPoints] = useState<{ t: number; angle: number | null; exercise_slug?: string | null }[]>([]);
  const [selectedExerciseSlug, setSelectedExerciseSlug] = useState<string | null>(exercise ?? null);

  const [overrides, setOverrides] = useState<any[]>([]);

  // Resolve therapist target for the selected exercise + child
  const effectiveTarget = useExerciseTarget(selectedExerciseSlug ?? "", childId ?? "", overrides, undefined);
  const resolvedTargetAngle = targetAngle ?? effectiveTarget?.angle?.primary ?? null;

  useEffect(() => {
    let mounted = true;
    async function load() {
      if (!childId) return;
      try {
        // fetch sessions for this child, include exercise_slug so we can pick/filter
        const q = supabase
          .from("sessions")
          .select("started_at,avg_range_of_motion_deg,exercise_slug")
          .eq("patient_id", childId)
          .order("started_at", { ascending: true })
          .limit(200);

        const { data, error } = await q;
        if (error) throw error;
        const pts = (data ?? []).map((s: any) => ({
          t: new Date(s.started_at).getTime(),
          angle: s.avg_range_of_motion_deg ?? null,
          exercise_slug: s.exercise_slug ?? null,
        }));

        if (mounted) {
          setPastPoints(pts);
          // If caller didn't pass an exercise, pick the most recent session's slug
          if (!exercise) {
            const last = pts.slice().reverse().find((p) => p.exercise_slug);
            setSelectedExerciseSlug(last?.exercise_slug ?? null);
          }

          // fetch therapist overrides for this child so we can resolve targets
          try {
            const fetched = await fetchChildExerciseTargets(childId);
            if (mounted) setOverrides(fetched);
          } catch (e) {
            console.warn("Failed to fetch child exercise targets", e);
          }
        }
      } catch (e) {
        console.error("ProgressGraph load error", e);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [childId, exercise]);

  const combined = useMemo(() => {
    // Merge past session points and liveHistory (liveHistory may have many samples)
    const items: { t: number; angle: number | null; source: "past" | "live" }[] = [];
    const filteredPast = selectedExerciseSlug
      ? pastPoints.filter((p) => p.exercise_slug === selectedExerciseSlug)
      : pastPoints;
    filteredPast.forEach((p) => items.push({ t: p.t, angle: p.angle, source: "past" }));
    (liveHistory ?? []).forEach((p) => items.push({ t: p.t, angle: p.angle ?? null, source: "live" }));
    items.sort((a, b) => a.t - b.t);
    return items;
  }, [pastPoints, liveHistory, selectedExerciseSlug]);

  if (combined.length === 0) {
    return <div style={{ textAlign: "center", padding: 12, opacity: 0.7 }}>No progress data yet.</div>;
  }

  const width = 640;
  const height = 160;
  const pad = 28;
  const times = combined.map((c) => c.t);
  const angles = combined.map((c) => (c.angle ?? NaN)).filter((v) => !Number.isNaN(v));
  const minT = Math.min(...times);
  const maxT = Math.max(...times, Date.now());
  const minA = Math.min(...(angles.length ? angles : [0, resolvedTargetAngle ?? 0]));
  const maxA = Math.max(...(angles.length ? angles : [resolvedTargetAngle ?? 100]));

  const xFor = (t: number) => pad + ((t - minT) / (maxT - minT || 1)) * (width - pad * 2);
  const yFor = (a: number) => height - pad - ((a - minA) / (maxA - minA || 1)) * (height - pad * 2);

  const pastPath = combined
    .filter((c) => c.source === "past" && c.angle != null)
    .map((p, i) => `${i === 0 ? "M" : "L"} ${xFor(p.t)} ${yFor(p.angle as number)}`)
    .join(" ");

  const livePath = combined
    .filter((c) => c.source === "live" && c.angle != null)
    .map((p, i) => `${i === 0 ? "M" : "L"} ${xFor(p.t)} ${yFor(p.angle as number)}`)
    .join(" ");

  // Latest values
  const latest = combined.slice().reverse().find((c) => c.angle != null);
  const previous = combined.slice().reverse().find((c) => c.angle != null && c.t < (latest?.t ?? 0));
  const delta = latest && previous && latest.angle != null && previous.angle != null ? Math.round((latest.angle - previous.angle) * 10) / 10 : null;

  return (
    <div style={{ maxWidth: width, margin: "12px auto" }}>
      <svg width={width} height={height} style={{ display: "block" }}>
        {/* background grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((p) => {
          const y = pad + p * (height - pad * 2);
          return <line key={p} x1={pad} x2={width - pad} y1={y} y2={y} stroke="#eee" />;
        })}

        {/* target line */}
        {resolvedTargetAngle != null && (
          <line
            x1={pad}
            x2={width - pad}
            y1={yFor(resolvedTargetAngle)}
            y2={yFor(resolvedTargetAngle)}
            stroke="#e11d48"
            strokeDasharray="4 4"
          />
        )}

        {/* past session path */}
        {pastPath && <path d={pastPath} fill="none" stroke="#3b82f6" strokeWidth={2} />}

        {/* live samples path */}
        {livePath && <path d={livePath} fill="none" stroke="#10b981" strokeWidth={2} />}

        {/* points */}
        {combined.map((c, i) =>
          c.angle != null ? (
            <circle
              key={i}
              cx={xFor(c.t)}
              cy={yFor(c.angle as number)}
              r={c.source === "live" ? 2.5 : 3}
              fill={c.source === "live" ? "#10b981" : "#3b82f6"}
              opacity={0.9}
            />
          ) : null,
        )}
      </svg>

      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "0 6px" }}>
        <div>
          <strong>{latest && latest.angle != null ? `${Math.round(latest.angle)}°` : "—"}</strong>
          <div style={{ opacity: 0.6 }}>Latest</div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ opacity: 0.6 }}>{formatDateShort(minT)}</div>
          <div style={{ opacity: 0.6 }}>{formatDateShort(maxT)}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div>
            {delta != null ? (
              <span style={{ color: delta >= 0 ? "#10b981" : "#ef4444" }}>{delta > 0 ? `+${delta}` : delta}°</span>
            ) : (
              "—"
            )}
          </div>
          <div style={{ opacity: 0.6 }}>Delta</div>
        </div>
      </div>
    </div>
  );
}
