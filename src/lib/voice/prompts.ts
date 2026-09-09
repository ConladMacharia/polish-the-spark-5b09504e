/**
 * Master list of the 30 caregiver voice prompts used in the live session.
 *
 * Each prompt has a stable CODE. Recordings are stored as
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
  /** English master text (supports {child}, {exercise}, {reps}, {seconds}). */
  en: string;
  /** When this prompt is played. */
  trigger: string;
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
  priority = 5,
  cooldownMs = 8000,
  ttlMs = 6000,
  bannerMs = 3800,
): VoicePromptDef {
  return { code, en, trigger, priority, cooldownMs, ttlMs, bannerMs };
}

export const VOICE_PROMPTS: VoicePromptDef[] = [
  /* ── 1. Welcome & setup ── */
  p("LS_01", "Welcome. Today's session is ready.", "Live session screen opens", 6, 60000, 8000),
  p("LS_02", "Place the phone so you can see {child} from head to toe.", "Camera opens for framing", 7, 20000, 8000, 4200),
  p("LS_03", "Step back a little — the whole body should fit on the screen.", "Framing not yet good after a few seconds", 7, 15000, 6000),
  p("LS_04", "Make sure the room is bright enough.", "Low light detected during framing", 6, 30000, 6000),
  p("LS_05", "Good, I can see {child} clearly.", "Framing becomes good", 6, 15000, 5000, 3000),
  p("LS_06", "Sit or stand beside {child}, not in front of the camera.", "Caregiver blocks the view", 7, 20000, 6000),

  /* ── 2. Starting ── */
  p("LS_07", "We will start now. Watch and encourage {child}.", "Framing complete, session starts", 6, 20000, 6000, 4200),
  p("LS_08", "First exercise: get ready.", "First exercise begins", 5, 20000, 6000),
  p("LS_09", "Show the movement once yourself, then let {child} try.", "Exercise demonstration step", 5, 25000, 6000, 4200),
  p("LS_10", "Move slowly. Slow is better than fast.", "Movement is too fast", 6, 15000, 5000),

  /* ── 3. During the movement ── */
  p("LS_11", "Raise both arms slowly overhead.", "Arm/shoulder raise exercise cue", 5, 12000, 5000),
  p("LS_12", "Reach forward and hold.", "Forward reach exercise cue", 5, 12000, 5000),
  p("LS_13", "Kick the leg forward, then bring it back gently.", "Leg kick exercise cue", 5, 12000, 5000),
  p("LS_14", "Stand steady, hands on the hips, and hold.", "Balance hold exercise cue", 5, 12000, 5000),
  p("LS_15", "Keep the back straight.", "Posture correction", 6, 12000, 5000),
  p("LS_16", "Support {child} lightly, but let them do the work.", "Caregiver is over-assisting", 6, 20000, 6000, 4200),
  p("LS_17", "A little higher, if there is no pain.", "Range of motion below target", 6, 12000, 5000),
  p("LS_18", "That is it — keep going just like that.", "Movement quality is good", 4, 12000, 4000, 3000),
  p("LS_19", "Hold it… and relax.", "End of a timed hold", 5, 6000, 4000, 2600),
  p("LS_20", "Well done. One more time.", "One repetition left", 5, 8000, 4000, 3000),

  /* ── 4. Counting & progress ── */
  p("LS_21", "Halfway there.", "Half of the repetitions done", 4, 20000, 4000, 2600),
  p("LS_22", "Repetitions finished for this set.", "Set complete", 5, 10000, 5000),
  p("LS_23", "Take a short rest, then we continue.", "Rest between sets", 5, 15000, 6000),
  p("LS_24", "Next exercise coming up.", "Moving to the next exercise", 6, 10000, 5000),

  /* ── 5. Safety ── */
  p("LS_25", "Stop if {child} feels pain.", "Pain or distress signal", 9, 20000, 8000, 5000),
  p("LS_26", "{child} looks tired. Let us rest a little.", "Fatigue detected", 8, 30000, 8000, 4600),
  p("LS_27", "Give {child} some water.", "Long session / rest break", 4, 120000, 8000),

  /* ── 6. Finishing ── */
  p("LS_28", "Last exercise. You are almost done.", "Final exercise starts", 6, 20000, 6000),
  p("LS_29", "Session complete. Very good work today.", "Session finished", 8, 30000, 10000, 4200),
  p("LS_30", "Come back tomorrow for the next session.", "After the session summary", 5, 60000, 10000, 4200),
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
