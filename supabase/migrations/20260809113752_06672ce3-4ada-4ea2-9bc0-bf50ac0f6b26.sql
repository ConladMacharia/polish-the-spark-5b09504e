DROP POLICY IF EXISTS "caregiver claim patient" ON public.patients;

CREATE OR REPLACE FUNCTION public.claim_patient_by_code(_claim_code text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _pid uuid;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.has_role(_uid, 'caregiver'::public.app_role) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF _claim_code IS NULL OR length(btrim(_claim_code)) <> 8 THEN
    RAISE EXCEPTION 'Invalid claim code';
  END IF;

  UPDATE public.patients p
     SET claimed_by_caregiver_id = _uid,
         claimed_at = now()
   WHERE p.claim_code = upper(btrim(_claim_code))
     AND p.claimed_by_caregiver_id IS NULL
  RETURNING p.id INTO _pid;

  IF _pid IS NULL THEN
    RAISE EXCEPTION 'Invalid claim code';
  END IF;

  RETURN _pid;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_patient_by_code(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_patient_by_code(text) TO authenticated;