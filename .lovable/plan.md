# What still needs work in Neuro-Bridge

Based on a read of the current code, here is what is genuinely unfinished — ordered by how much it affects real users.

## 1. Translations are half done (visible to every user)

Of the 47 languages in the picker, 13 bundles are complete (en, sw, ki, kam, luo, luy, kln, kis, mer, emb, mas, dav, dig, nyf, tur — 64 keys each) and **10 files are empty** (dug, mij, pkm, pko, saq, seg, sqm, swk, teo). The rest have no file at all and silently fall back to Swahili/English.

Nothing looks broken because of the fallback, but choosing e.g. Chiduruma or Ateso today changes nothing. This is a credits-bound generation run, not a code problem.

## 2. Incorrect-form video capture never got built

The original requirement was: record a short video snippet **only** when the AI detects the caregiver is doing the therapy wrong. There is no `MediaRecorder` anywhere in the app and no storage bucket for clips. Today a therapist sees numbers but never sees what went wrong.

Needs: a rolling in-memory buffer during a session, a trigger on sustained poor rep quality, upload to a private storage bucket, and a clips list on the therapist's patient page.

## 3. Therapist-side loop is thin

- AI reports exist, but plan assignment/adjustment (the "reduce therapist workload" goal) is still manual.
- No notifications when a child misses days or regresses.
- Patient page shows one patient at a time; no caseload triage view.

## 4. Child view polish

Games work and tracking self-heals, but: no per-child difficulty memory across sessions, no reward/streak persistence in the database, and the reward screens differ between games.

## 5. Home-use realities

- No PWA/offline support — clinic-introduced, home-used app on Kenyan mobile data currently needs a live connection for everything.
- No low-bandwidth mode for the reference videos.
- No caregiver onboarding walkthrough on first launch.

## 6. Smaller correctness items

- Landing, auth and every app route have their own metadata — this part is fine.
- Exercise target editing exists, but targets are not shown in the child games, only in the tracking session.
- Session data and reports have no export (PDF/print) for clinic visits.

## Where to start

My recommendation, in order: (2) form-failure video capture, then (1) finishing the translations, then (3) automatic plan adjustment. Tell me which one to take and I will write a build plan for it.
