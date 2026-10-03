-- =====================================================================
-- Neuro-Bridge: SECURITY CORE
--  1. Closes 3 gaps where a user could widen their own access
--  2. Adds location + consent fields to children (patients)
--  3. Adds the "requests" table (caregiver asks for a specialist)
--  4. Adds admin read access
-- Rule of thumb: default deny, then allow narrowly.
-- =====================================================================

-- ---------- helper checks (security definer = no policy recursion) ----------
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(), 'admin'::public.app_role)
$$;

CREATE OR REPLACE FUNCTION public.is_verified_therapist(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.therapists t
    WHERE t.user_id = _user_id AND t.verified = true
  ) AND public.has_role(_user_id, 'therapist'::public.app_role)
$$;

CREATE OR REPLACE FUNCTION public.child_owned_by(_child_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.patients p
    WHERE p.id = _child_id AND p.claimed_by_caregiver_id = _user_id
  )
$$;

-- ---------- GAP 1: a therapist could mark THEMSELVES verified ----------
-- Only an admin (or you, directly in the database / SQL editor) can verify.
CREATE OR REPLACE FUNCTION public.tg_guard_therapist_verified()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- auth.uid() is null for the SQL editor / service role: allowed.
  IF auth.uid() IS NOT NULL AND NOT public.is_admin() THEN
    IF TG_OP = 'INSERT' THEN
      NEW.verified := false;
    ELSE
      NEW.verified := OLD.verified;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_therapists_guard_verified ON public.therapists;
CREATE TRIGGER trg_therapists_guard_verified
  BEFORE INSERT OR UPDATE ON public.therapists
  FOR EACH ROW EXECUTE FUNCTION public.tg_guard_therapist_verified();

-- ---------- GAPS 2 + 3: who a child is linked to ----------
-- Before: a caregiver could point their child at ANY therapist, and a
-- therapist could hand a child to ANY caregiver. Now only an admin can
-- change the links. (Claiming a child with a code still works.)
CREATE OR REPLACE FUNCTION public.tg_guard_patient_links()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF NEW.therapist_id IS DISTINCT FROM OLD.therapist_id THEN
    RAISE EXCEPTION 'Only an admin can change which therapist a child is assigned to';
  END IF;

  IF NEW.claimed_by_caregiver_id IS DISTINCT FROM OLD.claimed_by_caregiver_id
     AND NOT (OLD.claimed_by_caregiver_id IS NULL AND NEW.claimed_by_caregiver_id = auth.uid()) THEN
    RAISE EXCEPTION 'Only an admin can change which caregiver a child belongs to';
  END IF;

  IF NEW.claim_code IS DISTINCT FROM OLD.claim_code THEN
    RAISE EXCEPTION 'The claim code cannot be changed';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_patients_guard_links ON public.patients;
CREATE TRIGGER trg_patients_guard_links
  BEFORE UPDATE ON public.patients
  FOR EACH ROW EXECUTE FUNCTION public.tg_guard_patient_links();

-- ---------- children: location, specialist needs, consent ----------
ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS county text,
  ADD COLUMN IF NOT EXISTS sub_county text,
  ADD COLUMN IF NOT EXISTS ward text,
  ADD COLUMN IF NOT EXISTS lat double precision,
  ADD COLUMN IF NOT EXISTS lng double precision,
  ADD COLUMN IF NOT EXISTS specialist_needs text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS consent_at timestamptz;

ALTER TABLE public.patients DROP CONSTRAINT IF EXISTS patients_lat_range;
ALTER TABLE public.patients ADD CONSTRAINT patients_lat_range CHECK (lat IS NULL OR lat BETWEEN -90 AND 90);
ALTER TABLE public.patients DROP CONSTRAINT IF EXISTS patients_lng_range;
ALTER TABLE public.patients ADD CONSTRAINT patients_lng_range CHECK (lng IS NULL OR lng BETWEEN -180 AND 180);

-- ---------- requests: "this child needs a specialist" ----------
CREATE TABLE IF NOT EXISTS public.requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  needs text[] NOT NULL DEFAULT '{}',
  notes text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'matched', 'accepted', 'completed', 'declined')),
  funder text NOT NULL DEFAULT 'self' CHECK (funder IN ('county', 'ngo', 'self')),
  assigned_therapist_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_requests_child ON public.requests(child_id);
CREATE INDEX IF NOT EXISTS idx_requests_therapist ON public.requests(assigned_therapist_id);
CREATE INDEX IF NOT EXISTS idx_requests_status ON public.requests(status);

GRANT SELECT, INSERT, UPDATE ON public.requests TO authenticated;
GRANT ALL ON public.requests TO service_role;
ALTER TABLE public.requests ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_requests_updated_at ON public.requests;
CREATE TRIGGER trg_requests_updated_at BEFORE UPDATE ON public.requests
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE OR REPLACE FUNCTION public.child_assigned_to_therapist(_child_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.requests r
    WHERE r.child_id = _child_id
      AND r.assigned_therapist_id = _user_id
      AND r.status IN ('matched', 'accepted', 'completed')
  )
$$;

-- Rules for changing a request.
--  * Only a VERIFIED therapist can ever be assigned (so an unverified one can't accept).
--  * A therapist may only: matched -> accepted/declined, accepted -> completed.
--    They cannot touch anything else on the request.
CREATE OR REPLACE FUNCTION public.tg_guard_requests()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.assigned_therapist_id IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.assigned_therapist_id IS DISTINCT FROM OLD.assigned_therapist_id)
     AND NOT public.is_verified_therapist(NEW.assigned_therapist_id) THEN
    RAISE EXCEPTION 'Only a verified therapist can be assigned to a request';
  END IF;

  IF TG_OP = 'UPDATE' AND auth.uid() IS NOT NULL AND NOT public.is_admin() THEN
    IF NEW.child_id IS DISTINCT FROM OLD.child_id
       OR NEW.created_by IS DISTINCT FROM OLD.created_by
       OR NEW.needs IS DISTINCT FROM OLD.needs
       OR NEW.notes IS DISTINCT FROM OLD.notes
       OR NEW.funder IS DISTINCT FROM OLD.funder
       OR NEW.assigned_therapist_id IS DISTINCT FROM OLD.assigned_therapist_id
       OR NEW.approved_by IS DISTINCT FROM OLD.approved_by THEN
      RAISE EXCEPTION 'Therapists can only respond to a request, not edit it';
    END IF;

    IF NOT ((OLD.status = 'matched'  AND NEW.status IN ('accepted', 'declined'))
         OR (OLD.status = 'accepted' AND NEW.status = 'completed')) THEN
      RAISE EXCEPTION 'That status change is not allowed (% -> %)', OLD.status, NEW.status;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_requests_guard ON public.requests;
CREATE TRIGGER trg_requests_guard
  BEFORE INSERT OR UPDATE ON public.requests
  FOR EACH ROW EXECUTE FUNCTION public.tg_guard_requests();

-- Caregiver: sees and creates requests for their OWN children only.
DROP POLICY IF EXISTS "requests caregiver read" ON public.requests;
CREATE POLICY "requests caregiver read" ON public.requests FOR SELECT TO authenticated
  USING (public.child_owned_by(child_id, auth.uid()));

DROP POLICY IF EXISTS "requests caregiver insert" ON public.requests;
CREATE POLICY "requests caregiver insert" ON public.requests FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND public.has_role(auth.uid(), 'caregiver'::public.app_role)
    AND public.child_owned_by(child_id, auth.uid())
    AND status = 'pending'
    AND assigned_therapist_id IS NULL
    AND approved_by IS NULL
  );

-- Therapist: sees requests assigned to them; only a verified one can answer.
DROP POLICY IF EXISTS "requests therapist read" ON public.requests;
CREATE POLICY "requests therapist read" ON public.requests FOR SELECT TO authenticated
  USING (assigned_therapist_id = auth.uid());

DROP POLICY IF EXISTS "requests therapist respond" ON public.requests;
CREATE POLICY "requests therapist respond" ON public.requests FOR UPDATE TO authenticated
  USING (assigned_therapist_id = auth.uid() AND public.is_verified_therapist(auth.uid()))
  WITH CHECK (assigned_therapist_id = auth.uid());

-- Admin: everything.
DROP POLICY IF EXISTS "requests admin all" ON public.requests;
CREATE POLICY "requests admin all" ON public.requests FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ---------- therapist can read ONLY children assigned to them via a request ----------
DROP POLICY IF EXISTS "therapist read assigned request children" ON public.patients;
CREATE POLICY "therapist read assigned request children" ON public.patients FOR SELECT TO authenticated
  USING (public.child_assigned_to_therapist(id, auth.uid()));

-- ---------- admin read access (and the few edits admin needs) ----------
DROP POLICY IF EXISTS "admin read profiles" ON public.profiles;
CREATE POLICY "admin read profiles" ON public.profiles FOR SELECT TO authenticated
  USING (public.is_admin());
DROP POLICY IF EXISTS "admin read user_roles" ON public.user_roles;
CREATE POLICY "admin read user_roles" ON public.user_roles FOR SELECT TO authenticated
  USING (public.is_admin());
DROP POLICY IF EXISTS "admin read therapists" ON public.therapists;
CREATE POLICY "admin read therapists" ON public.therapists FOR SELECT TO authenticated
  USING (public.is_admin());
DROP POLICY IF EXISTS "admin update therapists" ON public.therapists;
CREATE POLICY "admin update therapists" ON public.therapists FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "admin read patients" ON public.patients;
CREATE POLICY "admin read patients" ON public.patients FOR SELECT TO authenticated
  USING (public.is_admin());
DROP POLICY IF EXISTS "admin update patients" ON public.patients;
CREATE POLICY "admin update patients" ON public.patients FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "admin read sessions" ON public.sessions;
CREATE POLICY "admin read sessions" ON public.sessions FOR SELECT TO authenticated
  USING (public.is_admin());

-- ---------- function permissions ----------
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_verified_therapist(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.child_owned_by(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.child_assigned_to_therapist(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_verified_therapist(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.child_owned_by(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.child_assigned_to_therapist(uuid, uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.tg_guard_therapist_verified() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_guard_patient_links() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_guard_requests() FROM PUBLIC, anon, authenticated;
