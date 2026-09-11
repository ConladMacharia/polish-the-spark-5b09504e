import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useVoicePrompts } from "@/lib/voice/useVoicePrompts";
import { getLanguage, LANGUAGES } from "@/lib/i18n/languages";
import { useLanguage } from "@/lib/i18n/LanguageProvider";

export const Route = createFileRoute("/_authenticated/app/session")({
  head: () => ({
    meta: [{ title: "Live Session — Neuro-Bridge" }],
  }),
  component: LiveSession,
});

/* ── session exercises ── */
const SESSION_EXERCISES = [
  {
    name: "Arm Raise",
    cue: "Raise both arms slowly overhead",
    reps: 8,
    sets: 2,
    benefit:
      "Improves shoulder range of motion, upper-limb strength and posture.",
    assist:
      "Stand facing the child. Encourage a slow, controlled lift rather than a fast swing. Stop if there is shoulder pain.",
  },
  {
    name: "Leg Kick (left)",
    cue: "Kick toward the highlighted star",
    reps: 8,
    sets: 1,
    benefit: "Strengthens hip flexors and improves stepping pattern.",
    assist:
      "Support from behind if needed. Make sure the child is holding a rail or your hand before kicking.",
  },
  {
    name: "Balance Hold",
    cue: "Hold steady, hands on hips",
    reps: 3,
    sets: 1,
    benefit: "Postural control needed for all upright daily activities.",
    assist:
      "Stay close but don't hold — let the child find their own balance. Count aloud together to keep focus.",
  },
];

/* ── voice helper (runs outside React state to avoid re-render loops) ── */
function speak(text: string) {
  if (!("speechSynthesis" in window)) return;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.92;
    window.speechSynthesis.speak(u);
  } catch {
    /* silently ignore */
  }
}
function cancelSpeech() {
  if ("speechSynthesis" in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      /* ignore */
    }
  }
}

export default function LiveSession() {
  const navigate = useNavigate();
  const { lang } = useLanguage();
  const langName = getLanguage(lang).native;

  /* patient */
  const { data: patient } = useQuery({
    queryKey: ["my-patient"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) return null;
      const { data } = await supabase
        .from("patients")
        .select("child_name")
        .eq("claimed_by_caregiver_id", uid)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  const childName = patient?.child_name?.split("'")[0] ?? "your child";

  /* session state */
  const [idx, setIdx] = useState(0);
  const [done, setDone] = useState(false);

  /* camera overlay state */
  type CamSize = "collapsed" | "expanded" | "fullscreen";
  const [camSize, setCamSize] = useState<CamSize>("collapsed");
  const [framingOk, setFramingOk] = useState(false);

  /* feedback state — GREEN (good) or AMBER (adjust). NEVER red. */
  const [adjustMode, setAdjustMode] = useState(false);

  /* drawer */
  const [drawerOpen, setDrawerOpen] = useState(false);

  /* voice cue banner */
  const [voiceLine, setVoiceLine] = useState("");
  const [showVoice, setShowVoice] = useState(false);
  const [voiceSub, setVoiceSub] = useState("");
  const voiceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* framing timeouts cleanup */
  const framingTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const showBanner = useCallback((text: string, ms = 3800, subtitle = "") => {
    setVoiceLine(text);
    setVoiceSub(subtitle);
    setShowVoice(true);
    if (voiceTimer.current) clearTimeout(voiceTimer.current);
    voiceTimer.current = setTimeout(() => setShowVoice(false), ms);
  }, []);

  /* recorded voice prompt system */
  const { cue, unlock, stop } = useVoicePrompts(showBanner);

  /* show a custom banner + English TTS (for text not in the 30-prompt library) */
  const showCue = useCallback(
    (text: string, ms = 3800) => {
      showBanner(text, ms);
      speak(text);
    },
    [showBanner],
  );

  function clearFraming() {
    framingTimers.current.forEach(clearTimeout);
    framingTimers.current = [];
  }


  /* auto-framing sequence on mount / exercise change */
  const runFramingSequence = useCallback(() => {
    clearFraming();
    setFramingOk(false);
    setCamSize("collapsed");

    const t1 = setTimeout(() => {
      setCamSize("fullscreen");
      showCue(
        `Let's check the camera. Make sure ${childName}'s whole body is visible.`,
        3800,
      );
    }, 400);

    const t2 = setTimeout(() => {
      setFramingOk(true);
    }, 2800);

    const t3 = setTimeout(() => {
      setCamSize("collapsed");
      showCue(
        `Great, starting now. You're doing well — just watch and encourage ${childName}.`,
        4200,
      );
    }, 4200);

    framingTimers.current = [t1, t2, t3];
  }, [childName, showCue]);

  /* kick off framing on mount */
  useEffect(() => {
    runFramingSequence();
    return () => {
      clearFraming();
      cancelSpeech();
    };
  }, [runFramingSequence]);

  /* reset drawer & feedback when exercise changes */
  useEffect(() => {
    setDrawerOpen(false);
    setAdjustMode(false);
  }, [idx]);

  function handleNext() {
    if (idx + 1 >= SESSION_EXERCISES.length) {
      setDone(true);
      showCue("Session complete! Great work today.", 3000);
      cancelSpeech();
      setTimeout(
        () => showCue(`${childName} finished all exercises today!`, 3000),
        200,
      );
    } else {
      const next = SESSION_EXERCISES[idx + 1];
      showCue(`Nice work — moving on to ${next.name}.`, 3000);
      setIdx((i) => i + 1);
      runFramingSequence();
    }
  }

  function handleReplay() {
    const ex = SESSION_EXERCISES[idx];
    showCue(`Replaying ${ex.name}. ${ex.cue}`, 3200);
    setAdjustMode(false);
    setDrawerOpen(false);
  }

  function handleExit() {
    clearFraming();
    cancelSpeech();
    navigate({ to: "/app/caregiver" });
  }

  function toggleCamera() {
    if (camSize === "fullscreen") {
      setCamSize("collapsed");
    } else if (camSize === "collapsed") {
      setCamSize("expanded");
    } else {
      setCamSize("collapsed");
    }
  }

  function toggleFeedback() {
    const next = !adjustMode;
    setAdjustMode(next);
    if (next) {
      showCue(
        `Almost there — if there's no pain, help raise the arm a little higher.`,
        3800,
      );
    } else {
      showCue(`That's it, well done — keep going just like that.`, 3000);
    }
  }

  const ex = SESSION_EXERCISES[idx];
  const progress = Math.round((idx / SESSION_EXERCISES.length) * 100 + 20);

  /* camera size classes */
  const camClass =
    camSize === "fullscreen"
      ? "fixed inset-0 z-50 w-full h-full rounded-none border-0"
      : camSize === "expanded"
        ? "w-[268px] h-[374px]"
        : "w-[116px] h-[162px]";

  const feedbackColor = adjustMode
    ? { row: "#FDF3DF", face: "#E3A72E", text: "#4A3A0D", sub: "#8A6E1F" }
    : { row: "#E4F7EF", face: "#2FB380", text: "#1D3B2E", sub: "#4B7A63" };

  return (
    <>
      {/* ── Google Fonts (DM Mono for counter) ── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Baloo+2:wght@700;800&family=Nunito:wght@700;800&family=DM+Mono:wght@500;700&display=swap');
        :root {
          --s-primary: #3468C0;
          --s-primary-deep: #244B90;
          --s-bg: #F4F7FB;
          --s-ink: #1E2438;
          --s-ink-soft: #6B7284;
          --s-card: #FFFFFF;
          --s-border: #E4E9F2;
        }
        .session-root { font-family: 'Nunito', sans-serif; }
        .rep-counter { font-family: 'DM Mono', monospace; font-variant-numeric: tabular-nums; }
        .session-label { font-family: 'Baloo 2', sans-serif; }
        .voice-slide-in { animation: voiceIn 0.22s ease both; }
        @keyframes voiceIn { from { opacity:0; transform: translateX(-50%) translateY(10px); } to { opacity:1; transform: translateX(-50%) translateY(0); } }
        .cam-transition { transition: all 0.32s cubic-bezier(.2,.8,.3,1); }
        .live-dot { animation: livePulse 1.4s ease-in-out infinite; }
        @keyframes livePulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
        .drawer-anim { overflow: hidden; transition: max-height 0.28s ease; }
      `}</style>

      <div
        className="session-root min-h-screen relative"
        style={{ background: "var(--s-bg)", color: "var(--s-ink)" }}
      >
        {/* Exit button */}
        {!done && (
          <button
            onClick={handleExit}
            aria-label="Exit session"
            style={{
              position: "absolute",
              top: 14,
              left: 14,
              zIndex: 45,
              width: 34,
              height: 34,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.25)",
              color: "white",
              border: "none",
              fontSize: 16,
              cursor: "pointer",
            }}
          >
            ✕
          </button>
        )}

        {/* ── Zone 4: Camera preview thumbnail (fixed top-right) ── */}
        {!done && (
          <>
            {/* Backdrop when expanded/fullscreen */}
            {(camSize === "expanded" || camSize === "fullscreen") && (
              <div
                onClick={() => setCamSize("collapsed")}
                style={{
                  position: "fixed",
                  inset: 0,
                  background: "rgba(20,24,40,0.35)",
                  zIndex: 30,
                }}
              />
            )}

            <div
              onClick={toggleCamera}
              className="cam-transition"
              style={{
                position: camSize === "fullscreen" ? "fixed" : "absolute",
                top: camSize === "fullscreen" ? 0 : 6,
                right: camSize === "fullscreen" ? 0 : 6,
                transformOrigin: "top right",
                zIndex: 40,
                borderRadius: camSize === "fullscreen" ? 0 : 14,
                overflow: "hidden",
                cursor: "pointer",
                border:
                  camSize === "fullscreen"
                    ? "none"
                    : adjustMode
                      ? "3px solid #E3A72E"
                      : "3px solid #2FB380",
                boxShadow: "0 4px 14px rgba(0,0,0,0.28)",
                width:
                  camSize === "fullscreen"
                    ? "100vw"
                    : camSize === "expanded"
                      ? 268
                      : 116,
                height:
                  camSize === "fullscreen"
                    ? "100vh"
                    : camSize === "expanded"
                      ? 374
                      : 162,
              }}
            >
              {/* Camera feed mockup */}
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  background: "linear-gradient(160deg,#4A5A78,#232C40)",
                  position: "relative",
                }}
              >
                {/* LIVE dot */}
                <div
                  style={{
                    position: "absolute",
                    top: 8,
                    left: 8,
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    background: "rgba(0,0,0,0.4)",
                    borderRadius: 999,
                    padding: "3px 8px 3px 6px",
                  }}
                >
                  <span
                    className="live-dot"
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: "#FF4D4D",
                      display: "inline-block",
                    }}
                  />
                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 800,
                      color: "white",
                      letterSpacing: "0.04em",
                    }}
                  >
                    LIVE
                  </span>
                </div>

                {/* Child silhouette */}
                <svg
                  viewBox="0 0 60 100"
                  xmlns="http://www.w3.org/2000/svg"
                  style={{
                    position: "absolute",
                    bottom: 0,
                    left: "50%",
                    transform: "translateX(-50%)",
                    width: "55%",
                    opacity: 0.55,
                  }}
                >
                  <circle cx="30" cy="16" r="11" fill="#AEB9CC" />
                  <path
                    d="M12 100 L16 46 Q30 34 44 46 L48 100 L38 100 L35 60 L32 100 L28 100 L25 60 L22 100 Z"
                    fill="#AEB9CC"
                  />
                </svg>

                {/* Fullscreen framing guide */}
                {camSize === "fullscreen" && (
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <div
                      style={{
                        width: "62%",
                        height: "72%",
                        border: "3px dashed rgba(255,255,255,0.55)",
                        borderRadius: 24,
                      }}
                    />
                  </div>
                )}

                {/* Framing status badge (fullscreen only) */}
                {camSize === "fullscreen" && (
                  <div
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      right: 0,
                      padding: "22px 20px",
                      textAlign: "center",
                    }}
                  >
                    <span
                      style={{
                        display: "inline-block",
                        background: framingOk
                          ? "#2FB380"
                          : "rgba(0,0,0,0.45)",
                        color: "white",
                        fontFamily: "'Baloo 2', sans-serif",
                        fontWeight: 700,
                        fontSize: 15,
                        padding: "9px 18px",
                        borderRadius: 999,
                        transition: "background 0.3s ease",
                      }}
                    >
                      {framingOk
                        ? `Perfect — ${childName} is fully in frame ✓`
                        : `Checking ${childName} is fully in view…`}
                    </span>
                  </div>
                )}

                {/* Hint text (collapsed/expanded only) */}
                {camSize !== "fullscreen" && (
                  <div
                    style={{
                      position: "absolute",
                      bottom: 6,
                      left: 0,
                      right: 0,
                      textAlign: "center",
                      fontSize: camSize === "expanded" ? 11.5 : 9.5,
                      fontWeight: 700,
                      color: "rgba(255,255,255,0.85)",
                    }}
                  >
                    Tap to check framing
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* ── Voice Cue Banner ── */}
        {showVoice && (
          <div
            className="voice-slide-in"
            style={{
              position: "fixed",
              left: "50%",
              bottom: 108,
              transform: "translateX(-50%)",
              maxWidth: 340,
              width: "calc(100% - 48px)",
              background: "var(--s-ink)",
              color: "white",
              borderRadius: 16,
              padding: "12px 16px",
              display: "flex",
              alignItems: "center",
              gap: 10,
              zIndex: 45,
              boxShadow: "0 8px 22px rgba(0,0,0,0.25)",
            }}
          >
            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: "50%",
                background: "rgba(255,255,255,0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 14,
                flexShrink: 0,
              }}
            >
              🔊
            </div>
            <div style={{ fontSize: 13.5, fontWeight: 700, lineHeight: 1.35 }}>
              {voiceLine}
            </div>
          </div>
        )}

        {/* ── DONE STATE ── */}
        {done ? (
          <div
            style={{ textAlign: "center", padding: "80px 30px" }}
            className="session-label"
          >
            <div style={{ fontSize: 56, marginBottom: 12 }}>🎉</div>
            <h2 style={{ fontFamily: "'Baloo 2',sans-serif", fontSize: 28, margin: "0 0 8px" }}>
              Session complete!
            </h2>
            <p style={{ color: "var(--s-ink-soft)", fontWeight: 700, marginBottom: 28 }}>
              {childName} finished {SESSION_EXERCISES.length}/
              {SESSION_EXERCISES.length} exercises today. Great work!
            </p>
            <button
              onClick={handleExit}
              style={{
                background: "var(--s-primary)",
                color: "white",
                border: "none",
                borderRadius: 14,
                padding: "14px 28px",
                fontFamily: "'Baloo 2',sans-serif",
                fontWeight: 700,
                fontSize: 16,
                cursor: "pointer",
              }}
            >
              Back to home
            </button>
          </div>
        ) : (
          <>
            {/* ── Zone 1: Status Strip ── */}
            <div
              style={{
                background: "var(--s-primary)",
                color: "white",
                padding: "16px 20px 20px",
                borderRadius: "0 0 22px 22px",
              }}
            >
              <div style={{ textAlign: "center", marginBottom: 10 }}>
                <span
                  className="session-label"
                  style={{ fontWeight: 700, fontSize: 16 }}
                >
                  Exercise {idx + 1} of {SESSION_EXERCISES.length}
                </span>
              </div>
              <div
                style={{
                  height: 7,
                  background: "rgba(255,255,255,0.28)",
                  borderRadius: 999,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${progress}%`,
                    background: "white",
                    borderRadius: 999,
                    transition: "width 0.4s ease",
                  }}
                />
              </div>
            </div>

            {/* ── Zone 2: Exercise Card ── */}
            <div style={{ padding: "22px 20px 14px" }}>
              <div
                className="session-label"
                style={{ fontSize: 22, fontWeight: 700, textAlign: "center", marginBottom: 2 }}
              >
                {ex.name}
              </div>
              <div
                style={{
                  textAlign: "center",
                  fontSize: 14.5,
                  fontWeight: 700,
                  color: "var(--s-ink-soft)",
                  marginBottom: 20,
                }}
              >
                {ex.cue}
              </div>

              {/* Counter Block — DM Mono dominant element */}
              <div
                style={{
                  background: "var(--s-card)",
                  border: "1px solid var(--s-border)",
                  borderRadius: 24,
                  padding: "26px 20px 22px",
                  textAlign: "center",
                  boxShadow: "0 4px 18px rgba(30,36,56,0.05)",
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 800,
                    letterSpacing: "0.1em",
                    color: "var(--s-ink-soft)",
                    textTransform: "uppercase",
                    marginBottom: 6,
                  }}
                >
                  Reps completed
                </div>

                {/* THE dominant number — DM Mono 64px */}
                <div
                  className="rep-counter"
                  style={{
                    fontSize: 64,
                    fontWeight: 700,
                    lineHeight: 1,
                    letterSpacing: "-0.02em",
                    color: "var(--s-primary-deep)",
                  }}
                >
                  <span style={{ color: "var(--s-primary-deep)" }}>
                    {Math.min(4, ex.reps)}
                  </span>
                  <span
                    style={{
                      fontSize: 34,
                      color: "#B7C0D4",
                      margin: "0 4px",
                    }}
                  >
                    /
                  </span>
                  <span style={{ color: "var(--s-primary-deep)" }}>
                    {ex.reps}
                  </span>
                </div>
                <div
                  style={{
                    marginTop: 6,
                    fontSize: 13,
                    fontWeight: 700,
                    color: "var(--s-ink-soft)",
                  }}
                >
                  Set 1 of {ex.sets}
                </div>

                {/* Feedback Row — Green (good) or Amber (adjust). NEVER red. */}
                <div
                  style={{
                    marginTop: 16,
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    background: feedbackColor.row,
                    borderRadius: 14,
                    padding: "12px 14px",
                    transition: "background 0.3s ease",
                  }}
                >
                  <div
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: "50%",
                      background: feedbackColor.face,
                      flexShrink: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 17,
                      transition: "background 0.3s ease",
                    }}
                  >
                    {adjustMode ? "💡" : "🙂"}
                  </div>
                  <div style={{ textAlign: "left" }}>
                    <div
                      style={{
                        fontSize: 13.5,
                        fontWeight: 800,
                        color: feedbackColor.text,
                      }}
                    >
                      {adjustMode
                        ? "Try lifting a little higher"
                        : "Nice form — keep going"}
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: feedbackColor.sub,
                        marginTop: 1,
                      }}
                    >
                      {adjustMode
                        ? "Left arm below target angle"
                        : "Arms tracking correctly"}
                    </div>
                  </div>
                </div>

                {/* Collapsible drawer toggle */}
                <button
                  onClick={() => setDrawerOpen((o) => !o)}
                  style={{
                    marginTop: 14,
                    textAlign: "center",
                    fontSize: 13,
                    fontWeight: 800,
                    color: "var(--s-primary)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 4,
                    width: "100%",
                  }}
                >
                  <span>{drawerOpen ? "▴" : "▾"}</span>
                  <span>
                    {drawerOpen ? "Hide instructions" : "Full instructions"}
                  </span>
                </button>

                {/* Drawer content */}
                <div
                  className="drawer-anim"
                  style={{
                    maxHeight: drawerOpen ? 220 : 0,
                    background: "var(--s-card)",
                    borderRadius: 14,
                    border: drawerOpen ? "1px solid var(--s-border)" : "none",
                    marginTop: drawerOpen ? 8 : 0,
                  }}
                >
                  <div
                    style={{
                      padding: "14px 16px",
                      fontSize: 13,
                      color: "var(--s-ink-soft)",
                      fontWeight: 600,
                      lineHeight: 1.6,
                      textAlign: "left",
                    }}
                  >
                    <strong style={{ color: "var(--s-ink)" }}>Benefit:</strong>{" "}
                    {ex.benefit}
                    <br />
                    <br />
                    <strong style={{ color: "var(--s-ink)" }}>
                      Caregiver assist:
                    </strong>{" "}
                    {ex.assist}
                  </div>
                </div>
              </div>

              {/* Demo feedback toggle (dev helper) */}
              <button
                onClick={toggleFeedback}
                style={{
                  marginTop: 14,
                  textAlign: "center",
                  fontSize: 12,
                  fontWeight: 800,
                  color: "var(--s-ink-soft)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  width: "100%",
                }}
              >
                ⚙︎ Toggle demo feedback (Amber / Green)
              </button>
            </div>

            {/* ── Zone 3: Controls (3 max, thumb-reachable) ── */}
            <div
              style={{
                padding: "14px 20px 90px",
                display: "grid",
                gridTemplateColumns: "1fr 1.4fr 1fr",
                gap: 10,
              }}
            >
              <button
                onClick={handleReplay}
                style={{
                  borderRadius: 16,
                  border: "1.5px solid var(--s-border)",
                  padding: "15px 8px",
                  fontFamily: "'Baloo 2',sans-serif",
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 5,
                  background: "var(--s-card)",
                  color: "var(--s-ink)",
                }}
              >
                <span style={{ fontSize: 18 }}>↺</span> Replay
              </button>

              <button
                onClick={handleNext}
                style={{
                  borderRadius: 16,
                  border: "none",
                  padding: "15px 8px",
                  fontFamily: "'Baloo 2',sans-serif",
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 5,
                  background: "var(--s-primary)",
                  color: "white",
                }}
              >
                <span style={{ fontSize: 18 }}>⏭</span> Next
              </button>

              <button
                onClick={handleExit}
                style={{
                  borderRadius: 16,
                  border: "1.5px solid var(--s-border)",
                  padding: "15px 8px",
                  fontFamily: "'Baloo 2',sans-serif",
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 5,
                  background: "var(--s-card)",
                  color: "var(--s-ink)",
                }}
              >
                <span style={{ fontSize: 18 }}>⏸</span> Pause
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
