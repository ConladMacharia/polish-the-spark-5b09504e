/**
 * Master list of the 30 caregiver voice prompts used in the live session.
 *
 * Source: Voice_prompts.pdf — each prompt has a stable, language-independent
 * CODE. Recordings are stored as
 *   public/voice/<languageCode>/<CODE>.mp3
 * so the same code plays the right language without touching this file.
 *
 * `en` is the English master text: it is shown in the on-screen cue banner
 * (with {placeholders} filled in) and read aloud by the built-in voice when a
 * language has no recording yet.
 *
 * priority: higher wins when two prompts are queued at the same moment.
 * cooldownMs: the same prompt will not play again inside this window.
 * ttlMs: if the prompt could not start within this window it is dropped
 *        (stale coaching is worse than silence).
 */

export interface VoicePromptDef {
  /** Unique, language-independent code — also the mp3 file name. */
  code: string;
  /** English master text (supports {child}, {exercise}). */
  en: string;
  /** Human-readable trigger description. */
  trigger: string;
  /** Prompt category used to pick the right cue for an exercise. */
  category: "session" | "arm" | "hand" | "posture" | "leg" | "rep" | "safety";
  priority: number;
  cooldownMs: number;
  ttlMs: number;
  /** How long the banner stays on screen. */
  bannerMs: number;
}

function p(
  code: string,
  en: string,
  trigger: string,
  category: VoicePromptDef["category"],
  priority = 5,
  cooldownMs = 8000,
  ttlMs = 6000,
  bannerMs = 3800,
): VoicePromptDef {
  return { code, en, trigger, category, priority, cooldownMs, ttlMs, bannerMs };
}

export const VOICE_PROMPTS: VoicePromptDef[] = [
  /* ── 1. Session & Camera ── */
  p("LS001", "Let's begin the exercise.", "Start live session.", "session", 6, 60000, 8000),
  p("LS002", "Position the child as shown in the exercise.", "Initial positioning.", "session", 7, 20000, 8000, 4200),
  p("LS003", "Move the phone so I can see the child clearly.", "Poor camera view.", "session", 7, 15000, 6000),
  p("LS004", "Please adjust the camera so I can see the child's whole body.", "Body not fully visible.", "session", 7, 15000, 6000),

  /* ── 2. Arm & Shoulder ── */
  p("UL001", "Gently guide the child's arm through the movement.", "General arm guidance.", "arm", 5, 12000, 5000),
  p("UL002", "Guide the arm a little higher.", "Target angle not reached.", "arm", 6, 12000, 5000),
  p("UL003", "Help keep the child's elbow straight.", "Incorrect elbow position.", "arm", 6, 12000, 5000),
  p("UL004", "Keep the child's shoulder relaxed.", "Shoulder compensation.", "arm", 6, 12000, 5000),
  p("UL005", "Keep the child's body upright.", "Trunk leaning.", "arm", 6, 12000, 5000),
  p("UL006", "Slow the movement down.", "Movement too fast.", "arm", 6, 12000, 5000),
  p("UL007", "Hold the child's arm in this position.", "Target reached.", "arm", 5, 12000, 5000),
  p("UL008", "Slowly return the child's arm to the starting position.", "Complete repetition.", "arm", 5, 12000, 5000),

  /* ── 3. Hand & Wrist ── */
  p("HW001", "Gently guide the child's hand toward the target.", "Reach movement.", "hand", 5, 12000, 5000),
  p("HW002", "Help the child open the hand a little more.", "Incomplete hand opening.", "hand", 6, 12000, 5000),
  p("HW003", "Keep the child's wrist straight.", "Incorrect wrist position.", "hand", 6, 12000, 5000),
  p("HW004", "Slowly relax the child's hand.", "End of movement.", "hand", 5, 12000, 5000),

  /* ── 4. Posture & Balance ── */
  p("PT001", "Keep the child's body upright.", "Correct trunk posture.", "posture", 6, 12000, 5000),
  p("PT002", "Help the child stay centered.", "Weight shift correction.", "posture", 6, 12000, 5000),
  p("PT003", "Keep the child's shoulders level.", "Shoulder alignment.", "posture", 6, 12000, 5000),
  p("PT004", "Help the child maintain this position.", "Maintain posture during hold.", "posture", 5, 12000, 5000),

  /* ── 5. Leg & Lower Limb ── */
  p("LL001", "Gently guide the child's leg through the movement.", "General leg guidance.", "leg", 5, 12000, 5000),
  p("LL002", "Help straighten the child's knee a little more.", "Insufficient knee extension.", "leg", 6, 12000, 5000),
  p("LL003", "Lift the child's foot a little higher.", "Poor foot clearance.", "leg", 6, 12000, 5000),
  p("LL004", "Slowly return the child's leg to the starting position.", "Complete repetition.", "leg", 5, 12000, 5000),

  /* ── 6. Repetition & Hold Guidance ── */
  p("RH001", "Good. Hold this position.", "Target position achieved.", "rep", 5, 12000, 5000),
  p("RH002", "Three... two... one...", "Hold countdown.", "rep", 5, 6000, 4000, 2600),
  p("RH003", "One repetition completed.", "Successful repetition.", "rep", 4, 8000, 4000, 3000),

  /* ── 7. Safety ── */
  p("SF001", "Please stop the movement.", "Unsafe movement detected.", "safety", 9, 20000, 8000, 5000),
  p("SF002", "Do not force the child's movement.", "Movement beyond safe range.", "safety", 9, 20000, 8000, 5000),
  p("SF003", "If the child is uncomfortable, stop the exercise.", "Caregiver safety reminder.", "safety", 8, 30000, 8000, 4600),
];

export const PROMPTS_BY_CODE: Record<string, VoicePromptDef> = Object.fromEntries(
  VOICE_PROMPTS.map((d) => [d.code, d]),
);

export type VoicePromptCode = string;

export function fillVars(text: string, vars?: Record<string, string | number>) {
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (m, k) =>
    vars[k] !== undefined ? String(vars[k]) : m,
  );
}

/** Pick a sensible default prompt code for the named exercise type. */
export function defaultCueForExercise(exerciseName: string): VoicePromptCode {
  const name = exerciseName.toLowerCase();
  if (name.includes("leg") || name.includes("kick") || name.includes("knee")) return "LL001";
  if (name.includes("balance") || name.includes("posture") || name.includes("hold")) return "PT001";
  if (name.includes("hand") || name.includes("wrist") || name.includes("reach")) return "HW001";
  return "UL001";
}
