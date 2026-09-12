# Recorded caregiver prompts

One folder per language, named with the app's language code:

- `en` English
- `sw` Kiswahili
- `ki` Gĩkũyũ
- `luy` Luhya
- `nyf` Giriama
- …any other code from `src/lib/i18n/languages.ts`

Inside each folder, one mp3 per prompt code, named exactly as the code:

```text
public/voice/luy/LS001.mp3
public/voice/luy/LS002.mp3
public/voice/luy/LS003.mp3
public/voice/luy/LS004.mp3
public/voice/luy/UL001.mp3
...
public/voice/luy/SF003.mp3
```

The 30 codes, their English text and their triggers are listed in
`src/lib/voice/prompts.ts` and come from `Voice_prompts.pdf`:

- `LS001`–`LS004` — Session & Camera
- `UL001`–`UL008` — Arm & Shoulder
- `HW001`–`HW004` — Hand & Wrist
- `PT001`–`PT004` — Posture & Balance
- `LL001`–`LL004` — Leg & Lower Limb
- `RH001`–`RH003` — Repetition & Hold Guidance
- `SF001`–`SF003` — Safety

If a file is missing, the app reads the English text aloud instead — nothing
breaks, so folders can be filled a few prompts at a time.
