CREATE TABLE public.child_exercise_targets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  exercise_slug text NOT NULL,
  side text CHECK (side IN ('left','right')),
  target_angle_primary smallint,
  target_angle_secondary smallint,
  target_duration_seconds integer,
  target_reps smallint,
  set_by text NOT NULL DEFAULT '',
  note text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX child_exercise_targets_unique
  ON public.child_exercise_targets (patient_id, exercise_slug, COALESCE(side, ''));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.child_exercise_targets TO authenticated;
GRANT ALL ON public.child_exercise_targets TO service_role;

ALTER TABLE public.child_exercise_targets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "targets therapist all" ON public.child_exercise_targets
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.patients p WHERE p.id = child_exercise_targets.patient_id AND p.therapist_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.patients p WHERE p.id = child_exercise_targets.patient_id AND p.therapist_id = auth.uid()));

CREATE POLICY "targets caregiver read" ON public.child_exercise_targets
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.patients p WHERE p.id = child_exercise_targets.patient_id AND p.claimed_by_caregiver_id = auth.uid()));

CREATE TRIGGER trg_child_exercise_targets_updated_at
  BEFORE UPDATE ON public.child_exercise_targets
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();