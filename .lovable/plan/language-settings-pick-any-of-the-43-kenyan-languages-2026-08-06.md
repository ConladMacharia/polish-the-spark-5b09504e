# Language settings: pick any of the 43 Kenyan languages

Add a settings gear to the caregiver home dashboard that opens a language picker. Choosing a language (e.g. Kĩkamba) instantly re-renders every dashboard screen in that language, carries into the therapy player and its voice prompts, and is saved to the account so it follows the user to any device.

## What the user gets

- Gear icon in the dashboard header (also on the exercise library and therapist screens) opening a "Language / Lugha" panel.
- Searchable list of all 43 languages showing native names (Kĩkamba, Dholuo, Maa, Ekegusii…), current one highlighted.
- Tap a language → dashboard text, buttons, tips, exercise names and the child-mode wording all switch immediately.
- Launching the AI therapy player keeps the same language, including spoken prompts.
- Choice is remembered after sign-out/sign-in and on a new phone.

## How it works

### 1. Translatable dashboard text
Create `src/lib/i18n/strings.ts` holding every visible English string in the React app as keys (landing/auth stay English-first, dashboard + library + child mode are fully keyed), plus the shared 43-language table (code, English name, native name, voice fallback) moved out of the prototype into `src/lib/i18n/languages.ts` so both React and the player use one source.

### 2. AI-generated translation files, shipped in the app
Use the Lovable AI Gateway once at build time (a sandbox script, not runtime) to translate the string bundle into the remaining 40 languages, writing `src/lib/i18n/locales/<code>.json`. Hand-written `en`, `sw`, `ki` bundles stay authoritative and are not overwritten. Any key an AI file misses falls back to Swahili, then English, so no blank UI is possible. Generation runs in small batches per language and the files are committed, so the app needs no network to translate.

### 3. Language context + settings UI
- `src/lib/i18n/LanguageProvider.tsx`: React context exposing `t(key)` and `setLanguage(code)`, hydrating from profile → `localStorage` → device language → `en`. Mounted in `__root.tsx`.
- `src/components/LanguageSettings.tsx`: gear button + dialog (shadcn `Dialog` + `Input` search) rendering the language grid.
- Rewire `app.caregiver.tsx`, `app.exercises.tsx`, `app.index.tsx`, `app.therapist.tsx` and the patient detail screen to call `t()` instead of literal strings.

### 4. Persistence
`profiles.preferred_language` is an enum limited to `en|sw|ki`, so it cannot hold `kam`. Migration adds a nullable `ui_language text` column to `profiles` (and to `patients`, so the child's session language matches), with a length/format check; the existing enum column is left untouched for the therapist reports that already depend on it. Selection writes both `localStorage` and the profile row.

### 5. Player and voice prompts
- The launcher already passes credentials in the URL hash; add `lang=<code>`. `public/neuro-bridge/app.js` reads it, skips its own language-selection screen when present, and stores it under the existing `neuroBridgeLanguage` key.
- The player's translation tables gain the same generated locale JSON (inlined into a `translations.gen.js` file it loads), so exercise names, cues and on-screen coaching appear in the chosen language.
- Voice prompts: speech synthesis has no TTS voice for most Kenyan languages. Prompt text is spoken using the language's phonetic fallback voice (`sw-KE` for Bantu/Nilotic groups, `en-US` for Somali/KSL) while the spoken words themselves come from the translated text — the same approach already used for Gĩkũyũ. Text on screen is always the chosen language.

## Notes

- AI-produced translations for the 40 languages are machine quality; a small "Community translation — help us improve" line appears in the settings panel for languages outside en/sw/ki.
- Kenyan Sign Language stays labelled and displays English text, since it has no written form.
