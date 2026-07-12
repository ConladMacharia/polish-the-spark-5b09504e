
-- === ENUMS ===
CREATE TYPE public.app_role AS ENUM ('admin', 'therapist', 'caregiver');
CREATE TYPE public.exercise_type AS ENUM ('arm_raise', 'leg_kick', 'balance_hold', 'gait', 'postural_control');
CREATE TYPE public.affected_side AS ENUM ('left', 'right', 'bilateral', 'none');
CREATE TYPE public.gmfcs_level AS ENUM ('I', 'II', 'III', 'IV', 'V');
CREATE TYPE public.report_type AS ENUM ('daily', 'weekly', 'monthly', 'on_demand');
CREATE TYPE public.alert_type AS ENUM ('missed_sessions', 'pain_reported', 'regression', 'poor_form', 'goal_reached');
CREATE TYPE public.alert_severity AS ENUM ('info', 'warning', 'urgent');
CREATE TYPE public.mood_tag AS ENUM ('happy', 'tired', 'pain', 'frustrated', 'proud');
CREATE TYPE public.preferred_language AS ENUM ('en', 'sw', 'ki');

-- === updated_at helper ===
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- === profiles (one per auth user) ===
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  email TEXT,
  phone TEXT,
  preferred_language public.preferred_language NOT NULL DEFAULT 'en',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- === user_roles (separate table, security best practice) ===
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- === security-definer role check ===
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

-- === therapist extra info ===
CREATE TABLE public.therapists (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  clinic_name TEXT NOT NULL,
  license_number TEXT,
  country TEXT,
  city TEXT,
  verified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.therapists TO authenticated;
GRANT ALL ON public.therapists TO service_role;
ALTER TABLE public.therapists ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_therapists_updated_at BEFORE UPDATE ON public.therapists
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- === patients (owned by therapist, claimed by caregiver via code) ===
CREATE TABLE public.patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  therapist_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  claim_code TEXT NOT NULL UNIQUE,
  claimed_by_caregiver_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  claimed_at TIMESTAMPTZ,
  child_name TEXT NOT NULL,
  date_of_birth DATE,
  gmfcs_level public.gmfcs_level,
  affected_side public.affected_side NOT NULL DEFAULT 'none',
  condition_notes TEXT,
  goals TEXT[] NOT NULL DEFAULT '{}',
  contraindications TEXT,
  preferred_language public.preferred_language NOT NULL DEFAULT 'en',
  active BOOLEAN NOT NULL DEFAULT true,
  next_followup_at DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_patients_therapist ON public.patients(therapist_id);
CREATE INDEX idx_patients_caregiver ON public.patients(claimed_by_caregiver_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.patients TO authenticated;
GRANT ALL ON public.patients TO service_role;
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_patients_updated_at BEFORE UPDATE ON public.patients
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- === helper: does user have access to this patient? ===
CREATE OR REPLACE FUNCTION public.user_can_access_patient(_user_id UUID, _patient_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.patients p
    WHERE p.id = _patient_id
      AND (p.therapist_id = _user_id OR p.claimed_by_caregiver_id = _user_id)
  );
$$;

-- === exercise prescriptions (therapist-tailored plan per patient) ===
CREATE TABLE public.exercise_prescriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  exercise public.exercise_type NOT NULL,
  difficulty_level SMALLINT NOT NULL DEFAULT 1 CHECK (difficulty_level BETWEEN 1 AND 10),
  target_angle_deg SMALLINT,
  target_hold_ms INTEGER NOT NULL DEFAULT 1000,
  target_reps SMALLINT NOT NULL DEFAULT 8,
  frequency_per_week SMALLINT NOT NULL DEFAULT 5,
  active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (patient_id, exercise)
);
CREATE INDEX idx_prescriptions_patient ON public.exercise_prescriptions(patient_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exercise_prescriptions TO authenticated;
GRANT ALL ON public.exercise_prescriptions TO service_role;
ALTER TABLE public.exercise_prescriptions ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_prescriptions_updated_at BEFORE UPDATE ON public.exercise_prescriptions
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- === therapy sessions ===
CREATE TABLE public.sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  caregiver_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  exercise public.exercise_type NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  reps_completed SMALLINT NOT NULL DEFAULT 0,
  reps_target SMALLINT NOT NULL DEFAULT 0,
  completion_pct SMALLINT NOT NULL DEFAULT 0,
  avg_correctness SMALLINT,
  avg_range_of_motion_deg SMALLINT,
  difficulty_level SMALLINT NOT NULL DEFAULT 1,
  language_used public.preferred_language NOT NULL DEFAULT 'en',
  demo_mode BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_sessions_patient_time ON public.sessions(patient_id, started_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sessions TO authenticated;
GRANT ALL ON public.sessions TO service_role;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

-- === per-rep evaluation (for AI + DDA analysis) ===
CREATE TABLE public.rep_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  rep_number SMALLINT NOT NULL,
  correctness_score SMALLINT NOT NULL,
  angle_achieved_deg SMALLINT,
  hold_achieved_ms INTEGER,
  difficulty_at_time SMALLINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_rep_evals_session ON public.rep_evaluations(session_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rep_evaluations TO authenticated;
GRANT ALL ON public.rep_evaluations TO service_role;
ALTER TABLE public.rep_evaluations ENABLE ROW LEVEL SECURITY;

-- === pain/mood quick log ===
CREATE TABLE public.pain_mood_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  mood public.mood_tag NOT NULL,
  pain_level SMALLINT CHECK (pain_level BETWEEN 0 AND 10),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_painmood_patient ON public.pain_mood_logs(patient_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pain_mood_logs TO authenticated;
GRANT ALL ON public.pain_mood_logs TO service_role;
ALTER TABLE public.pain_mood_logs ENABLE ROW LEVEL SECURITY;

-- === AI reports ===
CREATE TABLE public.ai_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  report_type public.report_type NOT NULL,
  language public.preferred_language NOT NULL DEFAULT 'en',
  summary TEXT NOT NULL,
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ,
  recommended_followup_weeks SMALLINT,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_reports_patient ON public.ai_reports(patient_id, generated_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_reports TO authenticated;
GRANT ALL ON public.ai_reports TO service_role;
ALTER TABLE public.ai_reports ENABLE ROW LEVEL SECURITY;

-- === alerts to therapists ===
CREATE TABLE public.alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  therapist_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  alert_type public.alert_type NOT NULL,
  severity public.alert_severity NOT NULL DEFAULT 'info',
  message TEXT NOT NULL,
  resolved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_alerts_therapist ON public.alerts(therapist_id, resolved, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.alerts TO authenticated;
GRANT ALL ON public.alerts TO service_role;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;

-- === RLS POLICIES ===

-- profiles: own row only
CREATE POLICY "profiles self read" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles self insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles self update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- user_roles: user reads own; only service_role writes (roles granted server-side)
CREATE POLICY "user_roles self read" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- therapists: self read/write
CREATE POLICY "therapists self read" ON public.therapists FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "therapists self insert" ON public.therapists FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND public.has_role(auth.uid(), 'therapist'));
CREATE POLICY "therapists self update" ON public.therapists FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
-- caregivers can read basic therapist info of their patient's therapist
CREATE POLICY "caregivers read linked therapist" ON public.therapists FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.patients p WHERE p.therapist_id = therapists.user_id AND p.claimed_by_caregiver_id = auth.uid()));

-- patients: therapist owns; caregiver reads/updates claimed
CREATE POLICY "therapist read own patients" ON public.patients FOR SELECT TO authenticated USING (therapist_id = auth.uid());
CREATE POLICY "therapist insert own patients" ON public.patients FOR INSERT TO authenticated WITH CHECK (therapist_id = auth.uid() AND public.has_role(auth.uid(), 'therapist'));
CREATE POLICY "therapist update own patients" ON public.patients FOR UPDATE TO authenticated USING (therapist_id = auth.uid()) WITH CHECK (therapist_id = auth.uid());
CREATE POLICY "therapist delete own patients" ON public.patients FOR DELETE TO authenticated USING (therapist_id = auth.uid());
CREATE POLICY "caregiver read claimed patients" ON public.patients FOR SELECT TO authenticated USING (claimed_by_caregiver_id = auth.uid());
-- claim flow: caregiver can update a patient row to attach themselves IF unclaimed
CREATE POLICY "caregiver claim patient" ON public.patients FOR UPDATE TO authenticated
  USING (claimed_by_caregiver_id IS NULL AND public.has_role(auth.uid(), 'caregiver'))
  WITH CHECK (claimed_by_caregiver_id = auth.uid());

-- exercise_prescriptions: therapist manages; caregiver reads for their patient
CREATE POLICY "prescriptions therapist all" ON public.exercise_prescriptions FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.patients p WHERE p.id = patient_id AND p.therapist_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.patients p WHERE p.id = patient_id AND p.therapist_id = auth.uid()));
CREATE POLICY "prescriptions caregiver read" ON public.exercise_prescriptions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.patients p WHERE p.id = patient_id AND p.claimed_by_caregiver_id = auth.uid()));

-- sessions: caregiver inserts for their patient; both roles read
CREATE POLICY "sessions read" ON public.sessions FOR SELECT TO authenticated
  USING (public.user_can_access_patient(auth.uid(), patient_id));
CREATE POLICY "sessions caregiver insert" ON public.sessions FOR INSERT TO authenticated
  WITH CHECK (
    caregiver_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.patients p WHERE p.id = patient_id AND p.claimed_by_caregiver_id = auth.uid())
  );
CREATE POLICY "sessions caregiver update own" ON public.sessions FOR UPDATE TO authenticated
  USING (caregiver_id = auth.uid()) WITH CHECK (caregiver_id = auth.uid());

-- rep_evaluations: read if access to parent session's patient; insert if caregiver owns session
CREATE POLICY "rep_evals read" ON public.rep_evaluations FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.sessions s WHERE s.id = session_id AND public.user_can_access_patient(auth.uid(), s.patient_id)));
CREATE POLICY "rep_evals insert" ON public.rep_evaluations FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.sessions s WHERE s.id = session_id AND s.caregiver_id = auth.uid()));

-- pain_mood_logs
CREATE POLICY "painmood read" ON public.pain_mood_logs FOR SELECT TO authenticated
  USING (public.user_can_access_patient(auth.uid(), patient_id));
CREATE POLICY "painmood caregiver insert" ON public.pain_mood_logs FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.patients p WHERE p.id = patient_id AND p.claimed_by_caregiver_id = auth.uid()));

-- ai_reports: both roles read; only server-side (service_role) inserts
CREATE POLICY "reports read" ON public.ai_reports FOR SELECT TO authenticated
  USING (public.user_can_access_patient(auth.uid(), patient_id));

-- alerts: therapist reads/manages their own
CREATE POLICY "alerts therapist read" ON public.alerts FOR SELECT TO authenticated USING (therapist_id = auth.uid());
CREATE POLICY "alerts therapist update" ON public.alerts FOR UPDATE TO authenticated USING (therapist_id = auth.uid()) WITH CHECK (therapist_id = auth.uid());

-- === auto-create profile on signup ===
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, preferred_language)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.email,
    COALESCE((NEW.raw_user_meta_data->>'preferred_language')::public.preferred_language, 'en')
  );

  -- assign role from signup metadata (therapist or caregiver)
  IF NEW.raw_user_meta_data->>'role' IN ('therapist', 'caregiver') THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, (NEW.raw_user_meta_data->>'role')::public.app_role)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- === claim code generator ===
CREATE OR REPLACE FUNCTION public.generate_claim_code()
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result TEXT := '';
  i INT;
BEGIN
  FOR i IN 1..8 LOOP
    result := result || substr(chars, floor(random() * length(chars))::int + 1, 1);
  END LOOP;
  RETURN result;
END;
$$;
