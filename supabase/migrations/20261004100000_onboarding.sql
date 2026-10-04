-- =====================================================================
-- Onboarding: sign-in roles + therapist licence details and documents
--  1. claim_initial_role(): Google sign-ups (and anyone with no role yet)
--     get caregiver or therapist. NEVER admin, and never a second role.
--  2. therapists: county, issuing body, licence document, "details submitted" date
--  3. Changing the licence number or document sends a verified therapist
--     back to "pending" so an admin checks the new details
--  4. A private storage bucket for licence documents
-- =====================================================================

-- ---------- 1. first role for people who signed up without one ----------
CREATE OR REPLACE FUNCTION public.claim_initial_role(_role text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  existing public.app_role;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not signed in';
  END IF;

  SELECT role INTO existing FROM public.user_roles
  WHERE user_id = uid
  ORDER BY CASE role WHEN 'admin' THEN 1 WHEN 'therapist' THEN 2 ELSE 3 END
  LIMIT 1;

  -- Already has a role: nothing to claim, and it can never be changed this way.
  IF existing IS NOT NULL THEN
    RETURN existing::text;
  END IF;

  IF _role IS NULL OR _role NOT IN ('therapist', 'caregiver') THEN
    _role := 'caregiver';
  END IF;

  INSERT INTO public.user_roles (user_id, role) VALUES (uid, _role::public.app_role)
  ON CONFLICT DO NOTHING;

  IF _role = 'therapist' THEN
    INSERT INTO public.therapists (user_id, clinic_name) VALUES (uid, '')
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  RETURN _role;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_initial_role(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_initial_role(text) TO authenticated, service_role;

-- ---------- 2. therapist licence details ----------
ALTER TABLE public.therapists
  ADD COLUMN IF NOT EXISTS county text,
  ADD COLUMN IF NOT EXISTS license_body text,
  ADD COLUMN IF NOT EXISTS license_document_path text,
  ADD COLUMN IF NOT EXISTS profile_submitted_at timestamptz;

-- ---------- 3. new licence details = checked again ----------
CREATE OR REPLACE FUNCTION public.tg_guard_therapist_verified()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- auth.uid() is null for the SQL editor / service role: allowed.
  IF auth.uid() IS NOT NULL AND NOT public.is_admin() THEN
    IF TG_OP = 'INSERT' THEN
      NEW.verified := false;
    ELSE
      NEW.verified := OLD.verified;
      IF OLD.verified AND (
           NEW.license_number IS DISTINCT FROM OLD.license_number
        OR NEW.license_document_path IS DISTINCT FROM OLD.license_document_path
      ) THEN
        NEW.verified := false;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- ---------- 4. private bucket for licence documents ----------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('therapist-docs', 'therapist-docs', false, 5242880,
        ARRAY['application/pdf', 'image/jpeg', 'image/png'])
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['application/pdf', 'image/jpeg', 'image/png'];

-- Each therapist works only inside their own folder: therapist-docs/<their id>/...
DROP POLICY IF EXISTS "therapist docs insert own" ON storage.objects;
CREATE POLICY "therapist docs insert own" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'therapist-docs'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND public.has_role(auth.uid(), 'therapist'::public.app_role)
  );

DROP POLICY IF EXISTS "therapist docs read own" ON storage.objects;
CREATE POLICY "therapist docs read own" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'therapist-docs' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "therapist docs update own" ON storage.objects;
CREATE POLICY "therapist docs update own" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'therapist-docs' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'therapist-docs' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "therapist docs delete own" ON storage.objects;
CREATE POLICY "therapist docs delete own" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'therapist-docs' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Admins can open any licence document to verify it.
DROP POLICY IF EXISTS "therapist docs admin read" ON storage.objects;
CREATE POLICY "therapist docs admin read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'therapist-docs' AND public.is_admin());
