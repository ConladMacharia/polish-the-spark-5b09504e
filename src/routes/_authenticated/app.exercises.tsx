import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useRef, useState, useEffect } from "react";
import { PlayCircle, ArrowLeft } from "lucide-react";
import { PoseLandmarker, DrawingUtils } from "@mediapipe/tasks-vision";

import { getPoseLandmarker } from "@/lib/pose/poseLandmarker";
import {
  LandmarkSmoother,
  AngleRecorder,
  getElbowAngle,
  getShoulderFlexionAngle,
  type Side,
} from "@/lib/pose/angleUtils";
import { EXERCISES, type Exercise } from "@/lib/exercise-catalog";
import { LanguageSettings } from "@/components/LanguageSettings";
import { useLanguage } from "@/lib/i18n/LanguageProvider";


export const Route = createFileRoute("/_authenticated/app/exercises")({
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

function LiveSessionPage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const smoothersRef = useRef<Map<number, LandmarkSmoother>>(new Map());
  const [stream, setStream] = useState<MediaStream | null>(null);

  const [poseLandmarker, setPoseLandmarker] = useState<PoseLandmarker | null>(null);
  const [isPoseLoading, setIsPoseLoading] = useState(false);
  const [poseDetected, setPoseDetected] = useState(false);

  // Initialize camera stream
  useEffect(() => {
    if (!selectedExercise) return;

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
  }, [selectedExercise, stream, poseLandmarker]);


  function closeCamera() {
    setSelectedExercise(null);
    setPoseDetected(false);
    smoothersRef.current.clear();
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
  }

  const categories = useMemo(
    () => [
      {
        id: "upper",
        label: "Upper body",
        icon: "💪",
        track: "arm",
        subcats: [
          {
            id: "shoulder",
            label: "Shoulder",
            icon: "🦾",
            items: [
              { slug: "arm", name: "Forward reach", focus: "Flexion" },
              { slug: "arm-circles", name: "Arm lowering", focus: "Extension" },
              { slug: "side-bend", name: "Side reach", focus: "Abduction" },
              { slug: "midline", name: "Cross body reach", focus: "Adduction" },
              { slug: "wall-slide", name: "Rotation", focus: "Internal and external rotation" },
            ],
          },
          {
            id: "elbow",
            label: "Elbow",
            icon: "💪",
            items: [
              { slug: "reach", name: "Bend and straighten", focus: "Flexion and extension" },
              { slug: "shoulder", name: "Palm up, palm down", focus: "Supination and pronation" },
            ],
          },
          {
            id: "wrist",
            label: "Wrist",
            icon: "🖐️",
            items: [
              { slug: "draw", name: "Wrist bend up", focus: "Extension" },
              { slug: "tracing", name: "Wrist bend down", focus: "Flexion" },
              {
                slug: "page-turn",
                name: "Side to side wrist tilt",
                focus: "Radial and ulnar deviation",
              },
            ],
          },
          {
            id: "hand",
            label: "Hand & Fingers",
            icon: "🤲",
            keywords: ["hand", "finger", "grasp", "pincer", "thumb"],
          },
        ],
      },
      {
        id: "lower",
        label: "Lower body",
        icon: "🦵",
        track: "leg",
        subcats: [
          { id: "hip", label: "Hip", icon: "🦿", keywords: ["hip"] },
          { id: "knee", label: "Knee", icon: "🦵", keywords: ["knee"] },
          { id: "ankle", label: "Ankle", icon: "👟", keywords: ["ankle", "foot"] },
          { id: "balance", label: "Balance", icon: "⚖️", keywords: ["balance"] },
        ],
      },
    ],
    [],
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
    return matches.length ? matches : base;
  }

  return (
    <div className="min-h-screen bg-background text-foreground pb-12">
      <header className="border-b border-border bg-card/60 backdrop-blur sticky top-0 z-40">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate({ to: "/app/caregiver" })}
              aria-label="Back to dashboard"
              className="rounded-full bg-white/90 hover:bg-white p-2 shadow-sm"
            >
              <ArrowLeft className="h-4 w-4 text-slate-900" />
            </button>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">
                {t("exerciseLibrary")}
              </p>
              <p className="font-display text-lg font-bold text-slate-900">{t("yourToolkit")}</p>
            </div>
          </div>
          <LanguageSettings />
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8 space-y-10">
        {categories.map((cat) => (
          <section key={cat.id}>
            <div className="mb-4 flex items-center gap-3 border-b-3 border-dashed border-slate-900 pb-2">
              <span className="text-3xl">{cat.icon}</span>
              <h2 className="font-display text-2xl font-bold uppercase tracking-wide text-slate-900">
                {cat.label}
              </h2>
              <span className="ml-auto rounded-full bg-slate-900 px-3 py-1 text-xs font-extrabold text-white">
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
                      <span className="text-xl">{sub.icon}</span>
                      <h3 className="text-xs font-extrabold uppercase tracking-widest text-slate-600">
                        {sub.label}
                      </h3>
                      <span className="text-xs font-bold text-slate-400">· {items.length}</span>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {items.map((ex: Exercise) => (
                        <button
                          key={`${sub.id}-${ex.slug}`}
                          type="button"
                          onClick={() => setSelectedExercise(ex)}
                          className="flex flex-col overflow-hidden rounded-2xl border-3 border-slate-950 bg-card text-left shadow-[4px_4px_0px_#0f172a] transition-transform hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5"
                        >
                          <div className="relative flex h-24 items-center justify-center bg-gradient-to-br from-indigo-100 to-blue-200 text-4xl">
                            <span className="absolute left-2 top-2 rounded-md border border-slate-950 bg-lime-400 px-1.5 py-0.5 text-[10px] font-extrabold text-slate-950">
                              {t("aiTracked")}
                            </span>
                            {ex.icon}
                            <div className="absolute bottom-2 right-2 grid h-7 w-7 place-items-center rounded-full bg-slate-900/80">
                              <PlayCircle className="h-4 w-4 fill-white text-slate-900" />
                            </div>
                          </div>
                          <div className="flex flex-1 flex-col justify-between p-4">
                            <div>
                              <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                                {ex.focus}
                              </p>
                              <h4 className="mt-1 font-display text-lg font-bold leading-tight text-slate-900">
                                {ex.name}
                              </h4>
                            </div>
                            <span className="mt-4 border-t border-border pt-3 text-xs font-bold text-blue-600">
                              ai tracked exercise
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </main>

      {selectedExercise ? (
        <div className="fixed inset-0 z-50 bg-slate-950/95 text-white px-4 py-5 sm:px-6">
          <div className="mx-auto flex max-w-5xl flex-col gap-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">Live tracking</p>
                <h2 className="text-2xl font-bold">{selectedExercise.name}</h2>
                <p className="text-sm text-slate-300">{selectedExercise.focus}</p>
              </div>
              <button
                type="button"
                onClick={closeCamera}
                className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20"
              >
                Close
              </button>
            </div>
            <div className="relative overflow-hidden rounded-[2rem] bg-black shadow-2xl flex items-center justify-center min-h-[400px]">
              <video
                ref={videoRef}
                className="h-[70vh] w-full object-cover"
                muted
                playsInline
                autoPlay
              />
              <canvas
                ref={canvasRef}
                className="absolute inset-0 h-full w-full object-cover pointer-events-none z-10"
              />

              {/* Pose tracking status badges */}
              <div className="absolute top-4 left-4 flex flex-wrap gap-2 z-20">
                {stream && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-900/80 px-3 py-1 text-xs font-semibold text-white backdrop-blur border border-white/10">
                    <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                    Camera active
                  </span>
                )}
                {isPoseLoading && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/80 px-3 py-1 text-xs font-semibold text-slate-950 backdrop-blur">
                    Loading MediaPipe Pose…
                  </span>
                )}
                {poseLandmarker && (
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold backdrop-blur ${
                      poseDetected
                        ? "bg-emerald-500/90 text-white shadow-lg"
                        : "bg-slate-900/80 text-slate-300 border border-white/10"
                    }`}
                  >
                    <span
                      className={`h-2 w-2 rounded-full ${
                        poseDetected ? "bg-white animate-ping" : "bg-amber-400"
                      }`}
                    />
                    {poseDetected ? "Body skeleton tracked" : "Searching for person…"}
                  </span>
                )}
              </div>

              {!stream && !cameraError ? (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-950/70 text-sm text-slate-200 z-30">
                  Requesting camera access…
                </div>
              ) : null}
              {cameraError ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/80 px-4 text-center text-sm text-red-300 z-30">
                  <p>{cameraError}</p>
                  <p className="mt-2 text-xs text-slate-400">
                    Please allow camera access in your browser settings.
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
