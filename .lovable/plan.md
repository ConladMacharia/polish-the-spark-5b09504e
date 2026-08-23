# Finish the remaining 34 language translations

## Where things stand

10 of the 44 languages have full text today:

English, Kiswahili, Gĩkũyũ, Oluluhya, Dholuo, Kĩkamba, Kalenjin, Ekegusii, Kĩmĩrũ, Kĩembu.

34 still fall back to Swahili/English:

- Files exist but are empty (14): Kimijikenda, Chidigo, Chiduruma, Kigiryama, Kibajuni, Kipokomo, Kidawida, Kisegeju, Ng'aturkana, Maa, Sampur, Pökoot, Ateso, Olusuba.
- No file yet (20): Igikuria, Soomaali, Boraana, Rendille, Gabra, Orma, Kipsigis, Nandi, Markweeta, Tugen, Sabaot, Terik, Ogiek, Sengwer, El Molo, Yaakunte, Dahalo, Aweer, Ki-Nubi, Kenyan Sign Language (stays English text by design).

Nothing is broken meanwhile — every missing key falls back, so no blank UI.

## What blocked it

The last run stopped on an AI Gateway 402 "Not enough credits", then rate limits. It is a credits issue, not a code issue.

## The command to give me

Once the workspace has AI credits available, just say:

> resume translations

I will re-run the generation script for all 34 remaining languages, one language per request with a delay between calls to stay under rate limits, writing both `src/lib/i18n/locales/<code>.json` (dashboard) and `public/neuro-bridge/locales/<code>.json` (therapy player). Kenyan Sign Language is skipped intentionally.

You can also scope it, e.g. "translate Maa, Ateso and Turkana only" if you want to spend fewer credits first.

## Technical notes

- Script: `/tmp/gen_locales.py`, source keys from `src/lib/i18n/strings.ts` (64 keys), model `openai/gpt-5.6-sol` via the Lovable AI Gateway.
- Each language is validated as JSON with all 64 keys and `{placeholders}` preserved before being written; a failed language is retried rather than written half-empty.
- Existing hand-checked bundles (en, sw, ki) are never overwritten.
- After the run I will spot-check two languages in the preview (dashboard text + player prompts) before reporting done.
