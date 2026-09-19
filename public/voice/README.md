# Recorded caregiver prompts

One folder per language, named with the app's language code (see
`src/lib/i18n/languages.ts` for the full list, e.g. `en`, `sw`, `ki`, `luy`,
`nyf`, `luo`, `kis`, `kam`, `sgc`, …).

Inside each folder, one mp3 per prompt **code** — named exactly as the code,
case-insensitive. The 30 real codes (from `Voice_prompts.pdf` /
`src/lib/voice/prompts.ts`) are:

```
Session & camera:     LS001  LS002  LS003  LS004
Arm & shoulder:       UL001  UL002  UL003  UL004  UL005  UL006  UL007  UL008
Hand & wrist:         HW001  HW002  HW003  HW004
Posture & balance:    PT001  PT002  PT003  PT004
Leg & lower limb:     LL001  LL002  LL003  LL004
Repetition & hold:    RH001  RH002  RH003
Safety:               SF001  SF002  SF003
```

Example for Luhya:

```
public/voice/luy/LS001.mp3
public/voice/luy/UL002.mp3
public/voice/luy/RH001.mp3
…
```

Open `src/lib/voice/prompts.ts` to see each code's English text and the
real-world moment it fires at (target angle reached, movement too fast,
camera framing, etc.) — useful context for whoever is voicing the
recordings, not just a filename reference.

If a file is missing, the app reads the English text aloud instead —
nothing breaks, so folders can be filled in a few prompts at a time, in
any order.
