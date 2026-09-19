import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useRef, useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { PlayCircle, ArrowLeft, Home, Dumbbell, Video, User, X, Volume2 } from "lucide-react";
import { PoseLandmarker, DrawingUtils } from "@mediapipe/tasks-vision";

import { supabase } from "@/integrations/supabase/client";
import { getPoseLandmarker } from "@/lib/pose/poseLandmarker";
import {
  LandmarkSmoother,
  AngleRecorder,
  getElbowAngle,
  getShoulderFlexionAngle,
  type Side,
} from "@/lib/pose/angleUtils";
import { EXERCISES, translateExercise, type Exercise } from "@/lib/exercise-catalog";
import { LanguageSettings } from "@/components/LanguageSettings";
import { TargetBadge, useExerciseTarget } from "@/components/ExerciseTargetDisplay";
import { ChildProfileSheet } from "@/components/child/ChildProfileSheet";
import { AmbientBlobs, BottomNav, GlassCard } from "@/components/ui/glass";
import { useVoicePrompts } from "@/lib/voice/useVoicePrompts";
import { getLanguage } from "@/lib/i18n/languages";

import { useLanguage } from "@/lib/i18n/LanguageProvider";


export const Route = createFileRoute("/_authenticated/app/exercises")({
  validateSearch: (search: Record<string, unknown>): { guided?: boolean } => ({
    guided: search.guided === true || search.guided === "true" ? true : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Live session — Neuro-Bridge" },
      {
        name: "description",
        content:
          "Start an AI tracked cerebral palsy therapy session, grouped by upper and lower body.",
      },
      { property: "og:title", content: "Live session — Neuro-Bridge" },
      {
        property: "og:description",
        content: "AI tracked therapy exercises grouped by body region.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LiveSessionPage,
});

/**
 * The caregiver's guided daily session — a fixed, ordered sequence of real
 * catalog exercises, auto-advancing through real tracked reps rather than
 * a manual "Next" button. Ported from the retired app.session.tsx, which
 * had this exact plan and copy but no real camera behind it.
 */
type GuidedStep = { slug: string; targetReps: number; benefit: string; assist: string };
const DAILY_SESSION: GuidedStep[] = [
  {
    slug: "arm",
    targetReps: 8,
    benefit: "Improves shoulder range of motion, upper-limb strength and posture.",
    assist:
      "Stand facing the child. Encourage a slow, controlled lift rather than a fast swing. Stop if there is shoulder pain.",
  },
  {
    slug: "leg",
    targetReps: 8,
    benefit: "Strengthens hip flexors and improves stepping pattern.",
    assist:
      "Support from behind if needed. Make sure the child is holding a rail or your hand before kicking.",
  },
  {
    slug: "balance",
    targetReps: 3,
    benefit: "Postural control needed for all upright daily activities.",
    assist:
      "Stay close but don't hold — let the child find their own balance. Count aloud together to keep focus.",
  },
];

function LiveSessionPage() {
  const { t, lang } = useLanguage();
  const navigate = useNavigate();
  const { guided: guidedRequested } = Route.useSearch();
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const [pendingExercise, setPendingExercise] = useState<Exercise | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [guidedActive, setGuidedActive] = useState(false);
  const [guidedIndex, setGuidedIndex] = useState(0);
  const [guidedReps, setGuidedReps] = useState(0);
  const [sessionDone, setSessionDone] = useState(false);
  const balanceHoldStartRef = useRef<number | null>(null);
  const guidedAdvancingRef = useRef(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const smoothersRef = useRef<Map<number, LandmarkSmoother>>(new Map());
  const [stream, setStream] = useState<MediaStream | null>(null);
  const recorderRef = useRef(new AngleRecorder());
  const [liveAngle, setLiveAngle] = useState<number | null>(null);
  const [maxAngle, setMaxAngle] = useState<number | null>(null);
  const [trackedSide, setTrackedSide] = useState<Side>("right");
  // Which limb/joint the picked exercise targets, e.g. "shoulder", "elbow", "hip"
  const [pendingLimb, setPendingLimb] = useState<string>("arm");
  const [trackedLimb, setTrackedLimb] = useState<string>("arm");

  // Which joint angle to report for the selected exercise
  const ELBOW_SLUGS = new Set(["reach", "shoulder", "draw", "tracing", "page-turn"]);
  const trackedMovement: "elbow" | "shoulderFlexion" =
    selectedExercise && ELBOW_SLUGS.has(selectedExercise.slug) ? "elbow" : "shoulderFlexion";

  const [poseLandmarker, setPoseLandmarker] = useState<PoseLandmarker | null>(null);
  const [isPoseLoading, setIsPoseLoading] = useState(false);
  const [poseDetected, setPoseDetected] = useState(false);

  /* ── recorded voice prompt system ──
   * Reuses the existing prompt registry / player already built for the
   * (currently unlinked) guided session page — wired here to the real
   * pose-angle data this screen already tracks, instead of a mock timer. */
  const [voiceLine, setVoiceLine] = useState("");
  const [showVoice, setShowVoice] = useState(false);
  const voiceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showVoiceBanner = useCallback((text: string, ms: number) => {
    setVoiceLine(text);
    setShowVoice(true);
    if (voiceTimer.current) clearTimeout(voiceTimer.current);
    voiceTimer.current = setTimeout(() => setShowVoice(false), ms);
  }, []);
  const { cue, unlock, stop: stopVoice } = useVoicePrompts(showVoiceBanner);

  const target = useExerciseTarget(selectedExercise?.slug ?? "", "", [], trackedSide);
  const noPoseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dwellStartRef = useRef<number | null>(null);
  const holdReachedRef = useRef(false);
  const lastAngleSampleRef = useRef<{ angle: number; at: number } | null>(null);

  // Initialize camera stream
  useEffect(() => {
    if (!selectedExercise) return;

    recorderRef.current.reset();
    setLiveAngle(null);
    setMaxAngle(null);

    let cancelled = false;
    let localStream: MediaStream | null = null;

    async function startCamera() {
      setCameraError(null);
      try {
        localStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user" },
          audio: false,
        });
        if (cancelled) {
          localStream.getTracks().forEach((track) => track.stop());
          return;
        }
        if (videoRef.current) {
          videoRef.current.srcObject = localStream;
          await videoRef.current.play();
        }
        setStream(localStream);
      } catch (error) {
        setCameraError("Camera access failed. Please allow camera permission.");
      }
    }

    startCamera();

    return () => {
      cancelled = true;
      if (localStream) {
        localStream.getTracks().forEach((track) => track.stop());
      }
      setStream(null);
    };
  }, [selectedExercise]);

  // Model is warmed up from root layout; resolve the shared instance for this page
  useEffect(() => {
    let cancelled = false;
    setIsPoseLoading(true);
    getPoseLandmarker()
      .then((instance) => {
        if (!cancelled) setPoseLandmarker(instance);
      })
      .catch((err) => {
        console.error("MediaPipe Pose initialization failed:", err);
      })
      .finally(() => {
        if (!cancelled) setIsPoseLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);


  // Real-time detection & skeleton drawing loop (rAF, one frame at a time)
  useEffect(() => {
    if (!selectedExercise || !stream || !poseLandmarker) return;
    const landmarker = poseLandmarker;


    let lastVideoTime = -1;
    let active = true;
    let busy = false;
    let drawingUtils: DrawingUtils | null = null;

    function renderLoop() {
      if (!active) return;

      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (video && canvas && video.readyState >= 2 && !busy) {
        const ctx = canvas.getContext("2d");
        const vw = video.videoWidth || 640;
        const vh = video.videoHeight || 480;
        const cw = canvas.clientWidth || vw;
        const ch = canvas.clientHeight || vh;

        if (ctx) {
          if (canvas.width !== cw || canvas.height !== ch) {
            canvas.width = cw;
            canvas.height = ch;
            drawingUtils = null;
          }
          if (!drawingUtils) drawingUtils = new DrawingUtils(ctx);

          if (video.currentTime !== lastVideoTime) {
            lastVideoTime = video.currentTime;
            busy = true;
            try {
              const results = landmarker.detectForVideo(video, performance.now());

              ctx.clearRect(0, 0, cw, ch);

              if (results.landmarks && results.landmarks.length > 0) {
                setPoseDetected(true);

                const rawLandmarks = results.landmarks[0];
                const smoothedLandmarks = rawLandmarks.map((lm, i) => {
                  if (!smoothersRef.current.has(i)) {
                    smoothersRef.current.set(i, new LandmarkSmoother(0.3));
                  }
                  const smoothed = smoothersRef.current.get(i)!.update({ x: lm.x, y: lm.y });
                  return {
                    x: smoothed.x,
                    y: smoothed.y,
                    z: lm.z,
                    visibility: lm.visibility ?? 1,
                  };
                });

                // Match the video's object-cover crop so dots land on the body
                const scale = Math.max(cw / vw, ch / vh);
                const drawnW = vw * scale;
                const drawnH = vh * scale;
                ctx.save();
                ctx.translate((cw - drawnW) / 2, (ch - drawnH) / 2);
                ctx.scale(drawnW / cw, drawnH / ch);

                drawingUtils.drawConnectors(smoothedLandmarks, PoseLandmarker.POSE_CONNECTIONS, {
                  color: "#22C55E",
                  lineWidth: 4,
                });
                drawingUtils.drawLandmarks(smoothedLandmarks, {
                  color: "#FACC15",
                  fillColor: "#EF4444",
                  lineWidth: 2,
                  radius: (data: { from?: { z?: number } }) =>
                    DrawingUtils.lerp(data.from?.z ?? 0, -0.15, 0.1, 7, 3),
                });
                ctx.restore();

                // Joint angle from smoothed points, scaled to pixels so the
                // aspect ratio doesn't skew the measurement
                const pts = smoothedLandmarks.map((p) => ({ x: p.x * vw, y: p.y * vh }));
                const angle =
                  trackedMovement === "elbow"
                    ? getElbowAngle(pts, trackedSide)
                    : getShoulderFlexionAngle(pts, trackedSide);
                if (Number.isFinite(angle) && angle > 0) {
                  setLiveAngle(Math.round(angle));
                  recorderRef.current.record(angle);
                  const max = recorderRef.current.getMax();
                  setMaxAngle(max !== null ? Math.round(max) : null);
                }
              } else {
                setPoseDetected(false);
              }
            } catch (detectionErr) {
              console.warn("Pose detection frame skipped:", detectionErr);
            } finally {
              busy = false;
            }
          }
        }
      }

      animFrameRef.current = requestAnimationFrame(renderLoop);
    }

    animFrameRef.current = requestAnimationFrame(renderLoop);

    return () => {
      active = false;
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [selectedExercise, stream, poseLandmarker, trackedMovement, trackedSide]);

  /* ── voice cue: camera framing ──
   * If the camera is live but no body has been detected for a few seconds,
   * ask the caregiver to reposition the phone. */
  useEffect(() => {
    if (!selectedExercise || !stream) return;
    if (poseDetected) return;
    if (noPoseTimerRef.current) clearTimeout(noPoseTimerRef.current);
    noPoseTimerRef.current = setTimeout(() => {
      if (!poseDetected) cue("LS004");
    }, 4000);
    return () => {
      if (noPoseTimerRef.current) clearTimeout(noPoseTimerRef.current);
    };
  }, [selectedExercise, stream, poseDetected, cue]);

  /* ── voice cue: angle coaching, driven by the real tracked angle ──
   * Reuses whatever target this exercise/child/side already resolves to
   * (the same target shown in the on-screen TargetBadge) rather than a
   * separate guess — "reached" means the same thing in both places. */
  useEffect(() => {
    if (!selectedExercise || liveAngle === null) return;
    if (!target || target.targetType !== "angle" || !target.angle) return;

    const goal = target.angle.primary;
    const now = Date.now();
    const isOt = selectedExercise.category === "ot";
    const isLeg = selectedExercise.track === "leg";
    const stallCode = isOt ? "HW002" : isLeg ? "LL002" : "UL002";
    const returnCode = isOt ? "HW004" : isLeg ? "LL004" : "UL008";

    // Movement speed check (real, derived from consecutive samples).
    const last = lastAngleSampleRef.current;
    if (last && now - last.at < 1200) {
      const degPerSec = (Math.abs(liveAngle - last.angle) / (now - last.at)) * 1000;
      if (degPerSec > 220) cue("UL006");
    }
    lastAngleSampleRef.current = { angle: liveAngle, at: now };

    const nearGoal = liveAngle >= goal * 0.9;

    if (nearGoal) {
      if (dwellStartRef.current === null) dwellStartRef.current = now;
      if (!holdReachedRef.current && now - dwellStartRef.current > 600) {
        holdReachedRef.current = true;
        cue("RH001");
      }
    } else {
      dwellStartRef.current = null;
      // Coach toward the target only once a hold hasn't just happened —
      // avoids nagging immediately after a completed rep.
      if (!holdReachedRef.current && liveAngle < goal * 0.55) {
        cue(stallCode);
      }
      // Returning back down after a hold = a completed repetition.
      if (holdReachedRef.current && liveAngle < goal * 0.4) {
        holdReachedRef.current = false;
        cue(returnCode);
        cue("RH003");
        if (guidedActive) {
          setGuidedReps((r) => {
            const total = r + 1;
            const target = DAILY_SESSION[guidedIndex]?.targetReps ?? Infinity;
            if (total >= target) {
              // Let the two cues above actually play before we tear the camera down.
              setTimeout(() => advanceGuidedSession(), 1800);
            }
            return total;
          });
        }
      }
    }
  }, [liveAngle, target, selectedExercise, cue, guidedActive, guidedIndex]);

  function closeCamera() {
    setSelectedExercise(null);
    setPendingExercise(null);
    setPoseDetected(false);
    setGuidedActive(false);
    smoothersRef.current.clear();
    recorderRef.current.reset();
    setLiveAngle(null);
    setMaxAngle(null);
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    stopVoice();
    dwellStartRef.current = null;
    holdReachedRef.current = false;
    lastAngleSampleRef.current = null;
  }

  // Stop the camera and return to the arm picker for the same exercise
  function changeSide() {
    const current = selectedExercise;
    setSelectedExercise(null);
    setPoseDetected(false);
    smoothersRef.current.clear();
    recorderRef.current.reset();
    setLiveAngle(null);
    setMaxAngle(null);
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    stopVoice();
    dwellStartRef.current = null;
    holdReachedRef.current = false;
    lastAngleSampleRef.current = null;
    setPendingLimb(trackedLimb);
    setPendingExercise(current);
  }

  function startWithSide(side: Side) {
    unlock(); // user gesture — required for audio playback on mobile
    setTrackedSide(side);
    setTrackedLimb(pendingLimb);
    setSelectedExercise(pendingExercise);
    setPendingExercise(null);
    cue("LS001");
  }

  /** Begin one step of the guided daily session — auto-confirms a default
   *  side so the caregiver isn't stopped by the manual picker mid-flow. */
  function startGuidedStep(index: number) {
    const step = DAILY_SESSION[index];
    const exercise = EXERCISES.find((e) => e.slug === step.slug);
    if (!exercise) return; // catalog changed out from under the plan — bail quietly
    unlock();
    guidedAdvancingRef.current = false;
    setGuidedIndex(index);
    setGuidedReps(0);
    balanceHoldStartRef.current = null;
    setTrackedSide("right");
    setTrackedLimb(exercise.track === "leg" ? "leg" : "arm");
    setSelectedExercise(exercise);
    cue("LS001");
  }

  function advanceGuidedSession() {
    if (guidedAdvancingRef.current) return; // already advancing — ignore a second trigger
    guidedAdvancingRef.current = true;

    stopVoice();
    smoothersRef.current.clear();
    recorderRef.current.reset();
    setLiveAngle(null);
    setMaxAngle(null);
    setSelectedExercise(null);
    dwellStartRef.current = null;
    holdReachedRef.current = false;
    lastAngleSampleRef.current = null;

    const next = guidedIndex + 1;
    if (next >= DAILY_SESSION.length) {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
        setStream(null);
      }
      setGuidedActive(false);
      setSessionDone(true);
      return;
    }
    // Small pause between exercises so the last cue/hold isn't cut off.
    setTimeout(() => startGuidedStep(next), 900);
  }

  /* Kick off the guided session if the dashboard linked here with ?guided=true. */
  useEffect(() => {
    if (guidedRequested && !guidedActive && !selectedExercise && !pendingExercise && !sessionDone) {
      setGuidedActive(true);
      startGuidedStep(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guidedRequested]);

  /* Guided-mode completion for the duration-based balance step, since it
   * has no angle target to hold against. */
  useEffect(() => {
    if (!guidedActive || !selectedExercise || selectedExercise.slug !== "balance") return;
    if (!poseDetected) {
      balanceHoldStartRef.current = null;
      return;
    }
    if (balanceHoldStartRef.current === null) balanceHoldStartRef.current = Date.now();
    const holdMs = 10000; // real, if shorter-than-clinical, continuous-hold requirement
    const remaining = holdMs - (Date.now() - balanceHoldStartRef.current);
    if (remaining <= 0) {
      cue("RH003");
      setTimeout(() => advanceGuidedSession(), 1800);
      return;
    }
    const t = setTimeout(() => {
      if (balanceHoldStartRef.current !== null) cue("RH001");
    }, 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guidedActive, selectedExercise, poseDetected]);

  function limbLabel(side: Side, limb: string) {
    return `${side === "left" ? t("sideLeft") : t("sideRight")} ${limb}`;
  }

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
  const childNameForCopy = patient?.child_name?.split(" ")[0] ?? "your child";

  type NavId = "home" | "library" | "videos" | "profile";
  function handleNav(id: NavId) {
    if (id === "home") return navigate({ to: "/app/caregiver" });
    if (id === "videos") return navigate({ to: "/app/training" });
    if (id === "profile") return setProfileOpen(true);
    // "library" — already here, no-op
  }

  const categories = useMemo(
    () => [
      {
        id: "upper",
        label: t("upperBody"),
        icon: "💪",
        track: "arm",
        subcats: [
          {
            id: "shoulder",
            label: t("catShoulder"),
            icon: "🦾",
            items: [
              { slug: "arm", name: t("exForwardReach"), focus: t("focusFlexion") },
              { slug: "arm-circles", name: t("exArmLowering"), focus: t("focusExtension") },
              { slug: "side-bend", name: t("exSideReach"), focus: t("focusAbduction") },
              { slug: "midline", name: t("exCrossBodyReach"), focus: t("focusAdduction") },
              { slug: "wall-slide", name: t("exRotation"), focus: t("focusRotationFull") },
            ],
          },
          {
            id: "elbow",
            label: t("catElbow"),
            icon: "💪",
            items: [
              { slug: "reach", name: t("exBendStraighten"), focus: t("focusFlexionExtension") },
              { slug: "shoulder", name: t("exPalmUpDown"), focus: t("focusSupinationPronation") },
            ],
          },
          {
            id: "wrist",
            label: t("catWrist"),
            icon: "🖐️",
            items: [
              { slug: "draw", name: t("exWristBendUp"), focus: t("focusExtension") },
              { slug: "tracing", name: t("exWristBendDown"), focus: t("focusFlexion") },
              {
                slug: "page-turn",
                name: t("exWristTilt"),
                focus: t("focusRadialUlnar"),
              },
            ],
          },
          {
            id: "hand",
            label: t("catHandFingers"),
            icon: "🤲",
            keywords: ["hand", "finger", "grasp", "pincer", "thumb"],
          },
        ],
      },
      {
        id: "lower",
        label: t("lowerBody"),
        icon: "🦵",
        track: "leg",
        subcats: [
          { id: "hip", label: t("catHip"), icon: "🦿", keywords: ["hip"] },
          { id: "knee", label: t("catKnee"), icon: "🦵", keywords: ["knee"] },
          { id: "ankle", label: t("catAnkle"), icon: "👟", keywords: ["ankle", "foot"] },
          { id: "balance", label: t("catBalance"), icon: "⚖️", keywords: ["balance"] },
        ],
      },
    ],
    [t],
  );

  function findCategory(id: string) {
    return categories.find((c) => c.id === id) ?? null;
  }

  function exercisesForSubcat(catId: string, subId: string) {
    const cat = findCategory(catId);
    if (!cat) return [] as Exercise[];
    const sub: any = cat.subcats.find((s: any) => s.id === subId);
    const track = cat.track;
    const base = EXERCISES.filter((e) =>
      track === "leg" ? e.track === "leg" || e.track === "balance" : e.track === track,
    );
    if (!sub) return base;
    if (sub.items) {
      return sub.items.map((it: any) => {
        const found = EXERCISES.find((e) => e.slug === it.slug);
        return {
          ...(found ?? ({} as Exercise)),
          slug: it.slug,
          name: it.name,
          focus: it.focus,
          icon: found?.icon ?? "",
        } as Exercise;
      });
    }
    const keywords: string[] = sub.keywords ?? [];
    const matches = base.filter((e) => {
      const hay = `${e.name} ${e.focus} ${e.description} ${e.slug}`.toLowerCase();
      return keywords.some((k) => hay.includes(k));
    });
    const result = matches.length ? matches : base;
    return result.map((e) => translateExercise(e, t));
  }

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
              <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-300">
                {t("trackingEyebrow")}
              </p>
              <p className="font-display text-lg font-bold text-stone-50">{t("libraryTitle")}</p>
            </div>
          </div>
          <LanguageSettings />
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-5xl space-y-10 px-6 py-8">
        {categories.map((cat) => (
          <section key={cat.id}>
            <div className="mb-4 flex items-center gap-3 border-b border-white/10 pb-3">
              <span className="text-2xl">{cat.icon}</span>
              <h2 className="font-display text-lg font-bold text-stone-50">{cat.label}</h2>
              <span className="ml-auto rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-bold text-emerald-200 backdrop-blur-xl">
                {cat.subcats.reduce(
                  (n: number, s: any) => n + exercisesForSubcat(cat.id, s.id).length,
                  0,
                )}
              </span>
            </div>

            <div className="space-y-6">
              {cat.subcats.map((sub: any) => {
                const items = exercisesForSubcat(cat.id, sub.id);
                if (!items.length) return null;
                return (
                  <div key={sub.id}>
                    <div className="mb-3 flex items-center gap-2">
                      <span className="text-lg">{sub.icon}</span>
                      <h3 className="text-[11px] font-semibold uppercase tracking-wide text-stone-300">
                        {sub.label}
                      </h3>
                      <span className="text-[11px] font-semibold text-stone-500">· {items.length}</span>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {items.map((ex: Exercise, i: number) => (
                        <GlassCard
                          key={`${sub.id}-${ex.slug}`}
                          as="button"
                          tint={i % 2 === 0 ? "emerald" : "neutral"}
                          onClick={() => {
                            const label = String(sub.label).toLowerCase();
                            setPendingLimb(
                              label.includes("hand") || label.includes("finger")
                                ? "hand"
                                : label.includes("balance")
                                  ? "side"
                                  : label,
                            );
                            setPendingExercise(ex);
                          }}
                          className="flex flex-col text-left"
                        >
                          <div className="relative flex h-24 items-center justify-center bg-black/25 text-4xl">
                            <span className="absolute left-2 top-2 rounded-md border border-white/15 bg-white/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-200 backdrop-blur-xl">
                              {t("aiTracked")}
                            </span>
                            {ex.icon}
                            <div className="absolute bottom-2 right-2 grid h-7 w-7 place-items-center rounded-full bg-emerald-300/90">
                              <PlayCircle className="h-4 w-4 text-emerald-950" />
                            </div>
                          </div>
                          <div className="flex flex-1 flex-col justify-between p-4">
                            <div>
                              <p className="text-[10px] font-bold uppercase tracking-wide text-stone-400">
                                {ex.focus}
                              </p>
                              <h4 className="mt-1 font-display text-base font-bold leading-tight text-stone-50">
                                {ex.name}
                              </h4>
                            </div>
                            <span className="mt-3 border-t border-white/10 pt-2.5 text-[12px] font-bold text-emerald-300">
                              AI tracked exercise
                            </span>
                          </div>
                        </GlassCard>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </main>

      <div className="sticky bottom-0 z-10">
        <BottomNav<NavId>
          items={[
            { id: "home", icon: Home, label: t("home") },
            { id: "library", icon: Dumbbell, label: "Tracking" },
            { id: "videos", icon: Video, label: "Videos" },
            { id: "profile", icon: User, label: "You" },
          ]}
          active="library"
          onChange={handleNav}
        />
      </div>

      <ChildProfileSheet open={profileOpen} onOpenChange={setProfileOpen} patient={patient as never} />

      {pendingExercise ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-emerald-950/95 px-4 text-stone-50 backdrop-blur-sm">
          <GlassCard tint="emerald" className="w-full max-w-md p-6 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-300">Before we start</p>
            <h2 className="mt-1 font-display text-2xl font-bold text-stone-50">{pendingExercise.name}</h2>
            <p className="mt-2 text-sm text-stone-300">
              Which {pendingLimb} is being exercised? Tracking will measure that side only.
            </p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => startWithSide("left")}
                className="rounded-2xl bg-emerald-300 px-4 py-4 font-display text-base font-bold capitalize text-emerald-950 transition hover:bg-emerald-200"
              >
                {limbLabel("left", pendingLimb)}
              </button>
              <button
                type="button"
                onClick={() => startWithSide("right")}
                className="rounded-2xl bg-white/15 px-4 py-4 font-display text-base font-bold capitalize text-stone-50 backdrop-blur-xl transition hover:bg-white/20"
              >
                {limbLabel("right", pendingLimb)}
              </button>
            </div>
            <button
              type="button"
              onClick={() => setPendingExercise(null)}
              className="mt-4 text-sm font-semibold text-stone-400 underline"
            >
              Cancel
            </button>
          </GlassCard>
        </div>
      ) : null}

      {selectedExercise ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-emerald-950/95 px-4 py-5 text-stone-50 backdrop-blur-sm sm:px-6">
          <div className="mx-auto flex max-w-5xl flex-col gap-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-300">
                  {guidedActive ? `Guided session · step ${guidedIndex + 1} of ${DAILY_SESSION.length}` : "Live tracking"}
                </p>
                <h2 className="font-display text-2xl font-bold text-stone-50">{selectedExercise.name}</h2>
                <p className="text-sm text-stone-300">{selectedExercise.focus}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="hidden items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[11px] font-semibold text-emerald-200 backdrop-blur-xl sm:inline-flex">
                  <Volume2 className="h-3.5 w-3.5" />
                  {getLanguage(lang).native}
                </span>
                <button
                  type="button"
                  onClick={closeCamera}
                  className="grid h-9 w-9 place-items-center rounded-full border border-white/15 bg-white/10 backdrop-blur-xl transition hover:bg-white/20"
                >
                  <X className="h-4 w-4 text-stone-50" />
                </button>
              </div>
            </div>
            <div className="relative flex min-h-[400px] items-center justify-center overflow-hidden rounded-[2rem] bg-black shadow-2xl">
              <video
                ref={videoRef}
                className="h-[70vh] w-full object-cover"
                muted
                playsInline
                autoPlay
              />
              <canvas
                ref={canvasRef}
                className="absolute inset-0 z-10 h-full w-full object-cover pointer-events-none"
              />

              {/* Voice cue banner — mirrors whatever the audio/TTS just said */}
              {showVoice && voiceLine ? (
                <div className="absolute inset-x-0 top-4 z-30 flex justify-center px-4">
                  <div className="flex items-center gap-2 rounded-2xl border border-white/15 bg-emerald-950/90 px-4 py-2.5 text-center text-sm font-semibold text-stone-50 shadow-xl backdrop-blur-xl">
                    <Volume2 className="h-4 w-4 shrink-0 text-emerald-300" />
                    {voiceLine}
                  </div>
                </div>
              ) : null}

              {/* Pose tracking status badges */}
              <div className="absolute left-4 top-4 z-20 flex flex-wrap gap-2">
                {stream && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-emerald-950/80 px-3 py-1 text-xs font-semibold text-stone-50 backdrop-blur-xl">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-300" />
                    Camera active
                  </span>
                )}
                {isPoseLoading && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-400/90 px-3 py-1 text-xs font-semibold text-emerald-950 backdrop-blur-xl">
                    Loading MediaPipe Pose…
                  </span>
                )}
                {poseLandmarker && (
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold backdrop-blur-xl ${
                      poseDetected
                        ? "bg-emerald-300/90 text-emerald-950 shadow-lg"
                        : "border border-white/10 bg-emerald-950/80 text-stone-300"
                    }`}
                  >
                    <span
                      className={`h-2 w-2 rounded-full ${
                        poseDetected ? "animate-ping bg-emerald-950" : "bg-amber-400"
                      }`}
                    />
                    {poseDetected ? "Body skeleton tracked" : "Searching for person…"}
                  </span>
                )}
              </div>

              {!stream && !cameraError ? (
                <div className="absolute inset-0 z-30 flex items-center justify-center bg-emerald-950/70 text-sm text-stone-200">
                  Requesting camera access…
                </div>
              ) : null}
              {cameraError ? (
                <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-emerald-950/80 px-4 text-center text-sm text-red-300">
                  <p>{cameraError}</p>
                  <p className="mt-2 text-xs text-stone-400">
                    Please allow camera access in your browser settings.
                  </p>
                </div>
              ) : null}
            </div>

            <GlassCard tint="dark" className="flex flex-wrap items-center justify-between gap-4 p-5">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-400">
                  {guidedActive ? (
                    `Rep ${Math.min(guidedReps + 1, DAILY_SESSION[guidedIndex]?.targetReps ?? 1)} of ${DAILY_SESSION[guidedIndex]?.targetReps ?? "—"}`
                  ) : (
                    <>
                      Tracking: {limbLabel(trackedSide, trackedLimb)}
                      <button
                        type="button"
                        onClick={changeSide}
                        className="ml-2 rounded-full border border-white/15 bg-white/10 px-2 py-0.5 text-[10px] font-semibold normal-case tracking-normal text-stone-50 backdrop-blur-xl transition hover:bg-white/20"
                      >
                        Change side
                      </button>
                    </>
                  )}
                </p>
                <p className="font-display text-4xl font-bold tabular-nums text-stone-50">
                  {liveAngle !== null ? `${liveAngle}°` : "—"}
                </p>
              </div>
              <div className="text-stone-300">
                <TargetBadge
                  liveAngle={liveAngle}
                  exerciseSlug={selectedExercise.slug}
                  childId=""
                  overrides={[]}
                  side={trackedSide}
                />
              </div>
              <div className="text-right">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-400">Best this session</p>
                <p className="font-display text-2xl font-bold tabular-nums text-emerald-300">
                  {maxAngle !== null ? `${maxAngle}°` : "Not yet recorded"}
                </p>
              </div>
            </GlassCard>

            {guidedActive && DAILY_SESSION[guidedIndex] ? (
              <GlassCard tint="emerald" className="p-5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-300">
                  Why this exercise
                </p>
                <p className="mt-1 text-sm text-stone-200">{DAILY_SESSION[guidedIndex].benefit}</p>
                <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-emerald-300">
                  Helping {childNameForCopy}
                </p>
                <p className="mt-1 text-sm text-stone-200">{DAILY_SESSION[guidedIndex].assist}</p>
              </GlassCard>
            ) : null}
          </div>
        </div>
      ) : null}

      {sessionDone ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-emerald-950/95 px-4 text-center text-stone-50 backdrop-blur-sm">
          <GlassCard tint="emerald" className="w-full max-w-md p-8">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-300 text-3xl">🎉</div>
            <h2 className="mt-4 font-display text-2xl font-bold text-stone-50">Session complete!</h2>
            <p className="mt-2 text-sm text-stone-300">
              Great work today — {childNameForCopy} finished all {DAILY_SESSION.length} exercises.
            </p>
            <button
              type="button"
              onClick={() => {
                setSessionDone(false);
                navigate({ to: "/app/caregiver" });
              }}
              className="mt-6 w-full rounded-full bg-emerald-300 py-3 font-display text-sm font-bold text-emerald-950"
            >
              Back to dashboard
            </button>
          </GlassCard>
        </div>
      ) : null}
    </div>
  );
}
