# Recorded voice prompts in the live session

Play your own recorded prompts (mp3) during the live session, in whatever language the app is set to, each one triggered by something that happens on screen and never overlapping another prompt.

## How it will work

- Each prompt has a short code (for example `LS_01`). The code is the same in every language; only the recording changes.
- The app looks for the recording of the current language. If that language has no recording, it reads the English text aloud with the built-in voice instead.
- Every prompt has a trigger (session opens, exercise starts, camera can't see the child, rep counted, rest, exercise finished, and so on).
- After a trigger fires, the app waits 1-2 seconds, then plays. While something is playing, new prompts queue by priority instead of talking over it; low-value prompts that are already stale are dropped. The same prompt won't repeat within a short cool-down.
- The words also appear in the existing cue banner on screen, so the caregiver can read as well as hear.

## Folders — one per language

```text
public/voice/
  en/   LS_01.mp3 …
  luy/  LS_01.mp3 …   (Luhya)
  nyf/  LS_01.mp3 …   (Giriama)
```

Folder names match the language codes the app already uses (`luy` Luhya, `nyf` Giriama, `sw`, `ki`, etc.), and file names are exactly the prompt codes. To add a language later you drop in a new folder — no other change needed.

## Reorganising the files

Group the code by what it does, so future changes stay contained:

```text
src/features/session/     live session screen + its prompt triggers
src/features/child/       island map + the games
src/features/exercises/   catalog, targets, training videos
src/features/therapist/   therapist dashboards
src/lib/pose/             camera tracking (unchanged)
src/lib/i18n/             languages, text, and the new voice-prompt layer
```

Screens keep their web addresses; only the internal layout moves, done in one pass so nothing breaks.

## What I need from you

1. The 30 English prompts with their codes and the trigger for each (your master list).
2. The Luhya and Giriama mp3 files — the example you mentioned didn't come through, so nothing audio has reached me yet. Once the list is confirmed I'll set up the folders and you can drop the files in.

## Steps

1. Add the master prompt list (code, English text, trigger, priority, cool-down) as a single source of truth.
2. Add the audio player layer: pick the file for the current language, 1-2 s delay, one-at-a-time queue, English speech fallback, plus banner text.
3. Wire each trigger into the live session at the right moment.
4. Create `public/voice/<language>/` folders and load your Luhya and Giriama recordings.
5. Reorganise files into the feature folders above.
6. Check the session end to end in English, Luhya and Giriama: correct prompt, right timing, no overlap.

## Technical notes

- New `src/lib/i18n/voice-prompts.ts` (registry, keyed by code) and `src/lib/voice/promptPlayer.ts` (single `HTMLAudioElement`, priority queue, dedupe, cool-down, `speechSynthesis` fallback in English).
- Recordings served as static files from `public/voice/<code>/<PROMPT_CODE>.mp3`; a missing file falls back silently, so no broken-audio errors.
- Triggers hooked into the existing session state in `app.session.tsx`, replacing the current inline `speak()` calls; the cue banner stays as is.
- Prompt playback is unlocked on the first caregiver tap (Begin session) so mobile browsers allow audio.
