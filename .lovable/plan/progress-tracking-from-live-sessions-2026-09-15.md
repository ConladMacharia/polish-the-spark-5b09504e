# Progress tracking from live sessions

Turn the Progress card in the caregiver view into a real day-by-day line graph of angles achieved during live exercise sessions, measured against the therapist's target for that child.

## What the caregiver will see

- A line graph: days along the bottom, angle in degrees up the side.
- One point per day = the best angle the child reached that day for the chosen exercise (and side, left/right).
- A dashed target line at the therapist's target for that child (e.g. 150° for elbow extension). The graph's top is that target, so the line visibly climbs toward it.
- Under the graph: today's best, the change since the previous session (e.g. "+5°"), and how far from target (e.g. "45° to go", or "Target reached").
- A small picker to switch exercise and side, since targets differ per exercise.
- Friendly empty state when there is no session data yet.

## What has to change to make the numbers real

Right now the tracking screen measures angles live but never saves them, so the progress view has nothing to draw. So:

- When a tracked exercise ends, save that attempt: the best angle reached, the average, the exercise, and which side was tracked.
- Keep it tied to the child so the therapist sees the same numbers remotely.

## Technical detail

1. **Migration** on `sessions`: add `best_angle_deg smallint` and `side text` (nullable). Existing rows unaffected; no policy changes needed (caregiver insert/read policies already cover it).
2. **Saving** in `src/routes/_authenticated/app.exercises.tsx`: extract a `saveTrackedSession()` helper that inserts into `sessions` with `patient_id` (the caregiver's claimed patient), `caregiver_id`, `exercise`, `exercise_slug` (via `resolveTargetSlug`), `started_at`, `duration_seconds`, `avg_range_of_motion_deg`, `best_angle_deg` (from `AngleRecorder.getMax()`), and `side`. Called when the tracking modal closes with at least one recorded sample; skipped silently if no patient or no samples. Also apply the same save in `src/components/LiveTrackingSession.tsx`.
3. **Rewrite `src/components/ProgressGraph.tsx`**:
   - Fetch sessions for the child: `started_at, exercise_slug, side, best_angle_deg, avg_range_of_motion_deg`.
   - Group by local calendar day, take max of `best_angle_deg ?? avg_range_of_motion_deg` per day, filtered by selected exercise + side.
   - Target from `fetchChildExerciseTargets` + `getEffectiveTarget` (therapist override first, clinical default fallback); y-axis range 0…max(target, best) with the target as the drawn ceiling.
   - Render as an SVG line chart with day labels, points, target dashed line, plus delta and gap-to-target summary. Styled with existing design tokens/the caregiver's bordered-card look rather than the current inline greys.
4. Caregiver Progress modal already renders `ProgressGraph childId={patient.id}` — it gains the picker and stats automatically.
5. Verify with a Playwright pass on `/app/caregiver`: open Progress, confirm the graph and target line render, and typecheck with `bunx tsgo --noEmit`.
