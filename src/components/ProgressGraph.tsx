import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

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
  const [pastPoints, setPastPoints] = useState<{ t: number; angle: number | null }[]>([]);

  useEffect(() => {
    let mounted = true;
    async function load() {
      if (!childId) return;
      try {
        let q = supabase
          .from("sessions")
          .select("started_at,avg_range_of_motion_deg")
          .eq("patient_id", childId)
          .order("started_at", { ascending: true })
          .limit(60);
        if (exercise) q = q.eq("exercise", exercise as any);
        const { data, error } = await q;
        if (error) throw error;
        const pts = (data ?? []).map((s: any) => ({
          t: new Date(s.started_at).getTime(),
          angle: s.avg_range_of_motion_deg ?? null,
        }));
        if (mounted) setPastPoints(pts);
      } catch (e) {
        // swallow — graph is non-critical
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
    pastPoints.forEach((p) => items.push({ ...p, source: "past" }));
    (liveHistory ?? []).forEach((p) => items.push({ t: p.t, angle: p.angle ?? null, source: "live" }));
    items.sort((a, b) => a.t - b.t);
    return items;
  }, [pastPoints, liveHistory]);

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
  const minA = Math.min(...(angles.length ? angles : [0, targetAngle ?? 0]));
  const maxA = Math.max(...(angles.length ? angles : [targetAngle ?? 100]));

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
        {targetAngle != null && (
          <line
            x1={pad}
            x2={width - pad}
            y1={yFor(targetAngle)}
            y2={yFor(targetAngle)}
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
