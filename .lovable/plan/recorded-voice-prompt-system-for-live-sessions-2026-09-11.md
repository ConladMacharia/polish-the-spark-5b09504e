# Recorded Voice Prompt System for Live Sessions

## Goal
Replace the current English-only TTS cues in the caregiver Live Session with recorded, language-specific voice prompts. The system will use the 30 stable prompt codes from `Voice_prompts.pdf`, play each prompt 1–2 seconds after its trigger fires, prevent overlapping playback, and fall back to English TTS when a recording is missing.

## 1. Audio asset structure
Create one folder per language under `public/voice/`:

```text
public/voice/
  en/
    LS001.mp3
    LS002.mp3
    ...
  sw/
    LS001.mp3
    ...
  luy/
    LS001.mp3
    ...
```

- Filenames match the prompt IDs exactly (case-insensitive lookup at runtime).
- Supported format: `.mp3` (`.ogg` accepted as a fallback extension per file).
- First language to populate: **Luhya (`luy`)**, followed by Giriama and others as you upload them.

## 2. Prompt registry
Add a single source-of-truth file, `src/lib/voice/prompts.ts`, containing:

- All 30 prompt IDs from `Voice_prompts.pdf`.
- English display text for each ID (used for on-screen banners and TTS fallback).
- Trigger category (`session`, `arm`, `hand`, `posture`, `leg`, `rep`, `safety`).
- Per-prompt cooldown and priority so high-priority safety cues can interrupt lower-priority coaching cues.
- A small helper `getPromptUrl(lang, id)` that returns `/voice/<lang>/<id>.mp3` or `null` if no file exists.

## 3. Voice queue engine
Build `src/lib/voice/VoiceQueue.ts` (plain TypeScript, no React state):

- Accepts trigger events from the Live Session.
- Looks up the recording URL for the currently selected UI language.
- Delays playback by 1–2 seconds using a jittered timer.
- Maintains a single active audio element; new cues cancel the previous one only if the new cue has higher priority.
- Enforces per-prompt cooldown so the same cue cannot spam repeatedly.
- Emits a callback (`onCue`) so the UI can show a synchronized banner.
- Falls back to `SpeechSynthesisUtterance` in English when a recording is missing.

## 4. Live Session integration
Wire the voice queue into `src/routes/_authenticated/app.session.tsx`:

- On session start: trigger `LS001` ("Let's begin the exercise.").
- During framing/camera setup: trigger `LS003` / `LS004` when body visibility is poor.
- Per exercise:
  - `UL001` / `LL001` general guidance when movement starts.
  - `UL002` / `UL003` / `LL002` / `LL003` when angle or form cues fire.
  - `RH001` / `RH003` when a target is reached or a rep completes.
  - `SF001` / `SF002` / `SF003` when safety thresholds are hit.
- Keep the existing `showCue` banner; the voice queue will drive it via `onCue`.
- Ensure the current `useLanguage().lang` is read at trigger time, not cached once.

## 5. UI updates
- Reuse the existing banner component but add the prompt's English label as a subtitle so caregivers can confirm what was said.
- Add a small "voice language" indicator on the Live Session screen showing the active recorded language.

## 6. Fallback behavior
- If a recording is missing for the current language, play the English TTS version of the same prompt.
- If speech synthesis is unavailable, still show the banner.
- If the user switches language mid-session, the next trigger uses the newly selected language's recordings.

## 7. Extensibility
- Adding a new language only requires creating `public/voice/<code>/` and dropping files; no code changes.
- A future admin page can list missing recordings per language, but that is out of scope for this plan.

## Implementation steps
1. Create `src/lib/voice/prompts.ts` with the 30-prompt registry.
2. Create `src/lib/voice/VoiceQueue.ts` with delay, cooldown, priority, and fallback logic.
3. Add a `useVoiceQueue` hook in `src/lib/voice/useVoiceQueue.ts` that binds the queue to the current language and exposes a `trigger(id)` function.
4. Wire `trigger()` calls into `app.session.tsx` at the existing cue points.
5. Update the cue banner to show prompt text and language indicator.
6. Create `public/voice/luy/` and copy the first batch of Luhya `.mp3` files once they are uploaded.
7. Verify playback, timing, and non-overlap in a Live Session.

## Out of scope
- Extracting audio from `.aup3` Audacity project files.
- Recording new audio in-app.
- Prompts outside the 30-core Live Session list.
- Reorganizing the codebase folder structure.
