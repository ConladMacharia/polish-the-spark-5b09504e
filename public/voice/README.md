# Recorded caregiver prompts

One folder per language, named with the app's language code:

- `en` English
- `sw` Kiswahili
- `ki` Gĩkũyũ
- `luy` Luhya
- `nyf` Giriama
- …any other code from `src/lib/i18n/languages.ts`

Inside each folder, one mp3 per prompt code, named exactly as the code:

```
public/voice/luy/LS_01.mp3
public/voice/luy/LS_02.mp3
…
public/voice/luy/LS_30.mp3
```

The codes, their English text and their triggers are listed in
`src/lib/voice/prompts.ts`.

If a file is missing, the app reads the English text aloud instead — nothing
breaks, so folders can be filled in a few prompts at a time.
