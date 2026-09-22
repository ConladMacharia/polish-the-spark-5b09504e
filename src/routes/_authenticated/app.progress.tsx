import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Home, Dumbbell, Video, User, TrendingUp } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

import { supabase } from "@/integrations/supabase/client";
import { LanguageSettings } from "@/components/LanguageSettings";
import { ChildProfileSheet } from "@/components/child/ChildProfileSheet";
import { AmbientBlobs, BottomNav, GlassCard } from "@/components/ui/glass";

export const Route = createFileRoute("/_authenticated/app/progress")({
  head: () => ({ meta: [{ title: "Progress — Neuro-Bridge" }] }),
  component: ProgressPage,
});

type NavId = "home" | "library" | "videos" | "profile";

function ProgressRing({ pct, size = 140, stroke = 12 }: { pct: number; size?: number; stroke?: number }) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, pct));
  const offset = circumference * (1 - clamped / 100);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} stroke="rgba(255,255,255,0.1)" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="url(#progressRingGradient)"
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
        <defs>
          <linearGradient id="progressRingGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#6ee7b7" />
            <stop offset="100%" stopColor="#10b981" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <span className="font-display text-3xl font-bold text-stone-50">{Math.round(clamped)}%</span>
      </div>
    </div>
  );
}

function ProgressChart({ data, unit, emptyLabel }: { data: { label: string; value: number }[]; unit: string; emptyLabel: string }) {
  if (!data.length) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-stone-400">{emptyLabel}</div>
    );
  }
  return (
    <div className="h-40">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#34d399" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
          <XAxis dataKey="label" stroke="rgba(255,255,255,0.4)" fontSize={11} tickLine={false} axisLine={false} />
          <YAxis stroke="rgba(255,255,255,0.4)" fontSize={11} tickLine={false} axisLine={false} width={36} />
          <Tooltip
            contentStyle={{
              background: "rgba(6, 20, 15, 0.95)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 12,
              fontSize: 12,
            }}
            labelStyle={{ color: "#a7f3d0" }}
            formatter={(value: number) => [`${value}${unit}`, undefined]}
          />
          <Area type="monotone" dataKey="value" stroke="#34d399" strokeWidth={2.5} fill="url(#chartFill)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function ProgressPage() {
  const navigate = useNavigate();
  const [profileOpen, setProfileOpen] = useState(false);

  const { data: patient } = useQuery({
    queryKey: ["my-patient"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) return null;
      const { data } = await supabase
        .from("patients")
        .select("*")
        .eq("claimed_by_caregiver_id", uid)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  const patientId = patient?.id;

  const { data: armSessions } = useQuery({
    queryKey: ["progress-arm", patientId],
    enabled: !!patientId,
    queryFn: async () => {
      const { data } = await supabase
        .from("sessions")
        .select("started_at, avg_range_of_motion_deg")
        .eq("patient_id", patientId as string)
        .eq("exercise", "arm_raise")
        .not("avg_range_of_motion_deg", "is", null)
        .order("started_at", { ascending: true })
        .limit(14);
      return data ?? [];
    },
  });

  const { data: balanceSessions } = useQuery({
    queryKey: ["progress-balance", patientId],
    enabled: !!patientId,
    queryFn: async () => {
      const { data } = await supabase
        .from("sessions")
        .select("started_at, best_hold_ms")
        .eq("patient_id", patientId as string)
        .eq("exercise", "balance_hold")
        .not("best_hold_ms", "is", null)
        .order("started_at", { ascending: true })
        .limit(14);
      return data ?? [];
    },
  });

  const { data: todaySessions } = useQuery({
    queryKey: ["progress-today", patientId],
    enabled: !!patientId,
    queryFn: async () => {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const { data } = await supabase
        .from("sessions")
        .select("reps_completed, reps_target")
        .eq("patient_id", patientId as string)
        .gte("started_at", startOfDay.toISOString());
      return data ?? [];
    },
  });

  function handleNav(id: NavId) {
    if (id === "home") return navigate({ to: "/app/caregiver" });
    if (id === "library") return navigate({ to: "/app/exercises" });
    if (id === "videos") return navigate({ to: "/app/training" });
    if (id === "profile") return setProfileOpen(true);
  }

  const armData = (armSessions ?? []).map((s) => ({
    label: new Date(s.started_at).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    value: s.avg_range_of_motion_deg ?? 0,
  }));
  const balanceData = (balanceSessions ?? []).map((s) => ({
    label: new Date(s.started_at).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    value: Math.round((s.best_hold_ms ?? 0) / 100) / 10, // ms -> seconds, 1 decimal
  }));

  const todayReps = (todaySessions ?? []).reduce((s, r) => s + r.reps_completed, 0);
  const todayGoal = (todaySessions ?? []).reduce((s, r) => s + r.reps_target, 0);
  const todayPct = todayGoal > 0 ? (todayReps / todayGoal) * 100 : 0;
  const barPct = todayGoal > 0 ? Math.min(100, (todayReps / todayGoal) * 100) : 0;

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-emerald-950 via-[#05100c] to-emerald-950 pb-4 text-stone-50">
      <AmbientBlobs />

      <header className="sticky top-0 z-30 border-b border-white/10 bg-emerald-950/70 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate({ to: "/app/caregiver" })}
              aria-label="Back to dashboard"
              className="grid h-9 w-9 place-items-center rounded-full border border-white/15 bg-white/10 backdrop-blur-xl"
            >
              <ArrowLeft className="h-4 w-4 text-stone-50" />
            </button>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-300">Progress</p>
              <p className="font-display text-lg font-bold text-stone-50">How things are trending</p>
            </div>
          </div>
          <LanguageSettings />
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-5xl space-y-5 px-6 py-6">
        <GlassCard tint="emerald" className="p-5">
          <div className="mb-3 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-emerald-300" />
            <p className="font-display text-base font-bold text-stone-50">Arm &amp; Shoulder</p>
          </div>
          <p className="mb-2 text-[11px] text-stone-400">Best angle reached, per session</p>
          <ProgressChart data={armData} unit="°" emptyLabel="Complete an arm or shoulder session to see it here" />
        </GlassCard>

        <GlassCard tint="neutral" className="p-5">
          <div className="mb-3 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-emerald-300" />
            <p className="font-display text-base font-bold text-stone-50">Balance &amp; Holds</p>
          </div>
          <p className="mb-2 text-[11px] text-stone-400">Longest hold, per session</p>
          <ProgressChart data={balanceData} unit="s" emptyLabel="Complete a balance session to see it here" />
        </GlassCard>

        <GlassCard tint="dark" className="p-5">
          <p className="font-display text-base font-bold text-stone-50">Today's progress</p>
          <div className="mt-4 flex items-center gap-5">
            <ProgressRing pct={todayPct} />
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-400">Reps today</p>
              <p className="font-display text-2xl font-bold text-stone-50">
                {todayReps} <span className="text-base font-medium text-stone-400">of {todayGoal || "—"}</span>
              </p>
              <p className="mt-1 text-[12px] text-stone-400">
                {todayGoal > 0 ? "Keep going — every rep counts." : "No sessions tracked yet today."}
              </p>
            </div>
          </div>
          <div className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-300 transition-all"
              style={{ width: `${barPct}%` }}
            />
          </div>
        </GlassCard>

        <p className="px-1 text-[11px] leading-relaxed text-stone-500">
          Only exercises we can reliably measure show up here — arm/shoulder angle tracking and balance-type
          holds. Leg-specific tracking isn't accurate yet, so it's left out rather than shown as if it were.
        </p>
      </main>

      <div className="sticky bottom-0 z-10">
        <BottomNav<NavId>
          items={[
            { id: "home", icon: Home, label: "Home" },
            { id: "library", icon: Dumbbell, label: "Tracking" },
            { id: "videos", icon: Video, label: "Videos" },
            { id: "profile", icon: User, label: "You" },
          ]}
          onChange={handleNav}
        />
      </div>

      <ChildProfileSheet open={profileOpen} onOpenChange={setProfileOpen} patient={patient as never} />
    </div>
  );
}
