-- =====================================================================
-- Neuro-Bridge STEP 3: visits + therapist contact after acceptance
--  * visits: a therapist logs each home visit for a child they accepted
--  * a therapist can see the caregiver's name/phone ONLY after accepting
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.requests(id) ON DELETE CASCADE,
  child_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  therapist_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  visit_date date NOT NULL DEFAULT current_date,
  activities text NOT NULL,
  milestone_notes text,
  next_review date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT visits_activities_length CHECK (char_length(activities) BETWEEN 1 AND 2000),
  CONSTRAINT visits_notes_length CHECK (milestone_notes IS NULL OR char_length(milestone_notes) <= 2000)
);
CREATE INDEX IF NOT EXISTS idx_visits_child ON public.visits(child_id);
CREATE INDEX IF NOT EXISTS idx_visits_request ON public.visits(request_id);
CREATE INDEX IF NOT EXISTS idx_visits_therapist ON public.visits(therapist_id, visit_date DESC);

GRANT SELECT, INSERT, UPDATE ON public.visits TO authenticated;
GRANT ALL ON public.visits TO service_role;
ALTER TABLE public.visits ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_visits_updated_at ON public.visits;
CREATE TRIGGER trg_visits_updated_at BEFORE UPDATE ON public.visits
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- A visit can never be moved to another child, request or therapist.
CREATE OR REPLACE FUNCTION public.tg_guard_visits()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_admin() THEN
    IF NEW.request_id IS DISTINCT FROM OLD.request_id
       OR NEW.child_id IS DISTINCT FROM OLD.child_id
       OR NEW.therapist_id IS DISTINCT FROM OLD.therapist_id THEN
      RAISE EXCEPTION 'A visit cannot be moved to another child, request or therapist';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_visits_guard ON public.visits;
CREATE TRIGGER trg_visits_guard BEFORE UPDATE ON public.visits
  FOR EACH ROW EXECUTE FUNCTION public.tg_guard_visits();

-- Can this therapist log a visit for this request + child right now?
-- (verified, request is theirs, matches the child, and has been accepted)
CREATE OR REPLACE FUNCTION public.can_log_visit(_request_id uuid, _child_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_verified_therapist(_user_id)
    AND EXISTS (
      SELECT 1 FROM public.requests r
      WHERE r.id = _request_id
        AND r.child_id = _child_id
        AND r.assigned_therapist_id = _user_id
        AND r.status = 'accepted'
    )
$$;

DROP POLICY IF EXISTS "visits therapist read own" ON public.visits;
CREATE POLICY "visits therapist read own" ON public.visits FOR SELECT TO authenticated
  USING (therapist_id = auth.uid());

DROP POLICY IF EXISTS "visits therapist insert" ON public.visits;
CREATE POLICY "visits therapist insert" ON public.visits FOR INSERT TO authenticated
  WITH CHECK (therapist_id = auth.uid() AND public.can_log_visit(request_id, child_id, auth.uid()));

DROP POLICY IF EXISTS "visits therapist update own" ON public.visits;
CREATE POLICY "visits therapist update own" ON public.visits FOR UPDATE TO authenticated
  USING (therapist_id = auth.uid() AND public.is_verified_therapist(auth.uid()))
  WITH CHECK (therapist_id = auth.uid());

DROP POLICY IF EXISTS "visits caregiver read own child" ON public.visits;
CREATE POLICY "visits caregiver read own child" ON public.visits FOR SELECT TO authenticated
  USING (public.child_owned_by(child_id, auth.uid()));

DROP POLICY IF EXISTS "visits admin read" ON public.visits;
CREATE POLICY "visits admin read" ON public.visits FOR SELECT TO authenticated
  USING (public.is_admin());

-- ---------- therapist sees the caregiver's contact only AFTER accepting ----------
CREATE OR REPLACE FUNCTION public.is_my_accepted_caregiver(_caregiver_id uuid, _therapist_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.requests r
    JOIN public.patients p ON p.id = r.child_id
    WHERE r.assigned_therapist_id = _therapist_id
      AND r.status IN ('accepted', 'completed')
      AND p.claimed_by_caregiver_id = _caregiver_id
  )
$$;

DROP POLICY IF EXISTS "therapist read accepted caregiver profile" ON public.profiles;
CREATE POLICY "therapist read accepted caregiver profile" ON public.profiles FOR SELECT TO authenticated
  USING (public.is_my_accepted_caregiver(id, auth.uid()));

-- ---------- function permissions ----------
REVOKE ALL ON FUNCTION public.can_log_visit(uuid, uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_my_accepted_caregiver(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_log_visit(uuid, uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_my_accepted_caregiver(uuid, uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.tg_guard_visits() FROM PUBLIC, anon, authenticated;
