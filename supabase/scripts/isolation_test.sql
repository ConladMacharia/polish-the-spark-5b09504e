-- =====================================================================
-- Neuro-Bridge ISOLATION TEST
-- Paste this whole file into the Supabase SQL Editor and click Run.
-- It makes temporary fake people, tries to break the rules as each of
-- them, then deletes everything it made. The table at the end shows
-- PASS / FAIL for each check. Re-run after every database change.
-- =====================================================================

DROP TABLE IF EXISTS pg_temp.nb_results;
CREATE TEMP TABLE nb_results (n serial, check_name text, result text);

CREATE OR REPLACE FUNCTION pg_temp.nb_login(_uid uuid, _role text DEFAULT 'authenticated')
RETURNS void LANGUAGE plpgsql AS $f$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', COALESCE(_uid::text, ''), true);
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', _uid, 'role', _role)::text, true);
  EXECUTE format('SET LOCAL ROLE %I', _role);
END $f$;

CREATE OR REPLACE FUNCTION pg_temp.nb_logout()
RETURNS void LANGUAGE plpgsql AS $f$
BEGIN
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claims', '', true);
END $f$;

CREATE OR REPLACE FUNCTION pg_temp.nb_cleanup()
RETURNS void LANGUAGE plpgsql AS $f$
DECLARE ids uuid[];
BEGIN
  SELECT array_agg(id) INTO ids FROM auth.users WHERE email LIKE 'nb-test-%@example.invalid';
  IF ids IS NULL THEN RETURN; END IF;
  DELETE FROM public.requests WHERE created_by = ANY(ids) OR assigned_therapist_id = ANY(ids);
  DELETE FROM public.patients WHERE claimed_by_caregiver_id = ANY(ids) OR therapist_id = ANY(ids);
  DELETE FROM public.therapists WHERE user_id = ANY(ids);
  DELETE FROM auth.users WHERE id = ANY(ids);
END $f$;

SELECT pg_temp.nb_cleanup();

DO $$
DECLARE
  cg_a uuid := gen_random_uuid();
  cg_b uuid := gen_random_uuid();
  th_1 uuid := gen_random_uuid();
  th_2 uuid := gen_random_uuid();
  adm  uuid := gen_random_uuid();
  child_a uuid;
  child_b uuid;
  req uuid;
  cnt int;
  rows_changed int;
  v boolean;
BEGIN
  -- ---- fake people (the signup trigger gives each their role) ----
  INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
    (cg_a, 'nb-test-caregiver-a@example.invalid', '{"role":"caregiver"}'),
    (cg_b, 'nb-test-caregiver-b@example.invalid', '{"role":"caregiver"}'),
    (th_1, 'nb-test-therapist-1@example.invalid', '{"role":"therapist"}'),
    (th_2, 'nb-test-therapist-2@example.invalid', '{"role":"therapist"}'),
    (adm,  'nb-test-admin@example.invalid',       '{"role":"caregiver"}');
  -- admins are only ever made directly in the database, never by sign-up
  INSERT INTO public.user_roles (user_id, role) VALUES (adm, 'admin');
  -- therapist 1 is verified, therapist 2 is not
  INSERT INTO public.therapists (user_id, clinic_name, verified) VALUES
    (th_1, 'Test Clinic 1', true), (th_2, 'Test Clinic 2', false);
  -- one child each for the two caregivers
  INSERT INTO public.patients (child_name, claim_code, claimed_by_caregiver_id)
    VALUES ('Child A', public.generate_claim_code(), cg_a) RETURNING id INTO child_a;
  INSERT INTO public.patients (child_name, claim_code, claimed_by_caregiver_id)
    VALUES ('Child B', public.generate_claim_code(), cg_b) RETURNING id INTO child_b;

  -- 1. caregiver_a cannot see caregiver_b's children
  PERFORM pg_temp.nb_login(cg_a);
  SELECT count(*) INTO cnt FROM public.patients WHERE id = child_b;
  PERFORM pg_temp.nb_logout();
  INSERT INTO nb_results (check_name, result)
    VALUES ('Caregiver A cannot see Caregiver B''s child', CASE WHEN cnt = 0 THEN 'PASS' ELSE 'FAIL' END);

  -- 2. caregiver_a CAN see their own child
  PERFORM pg_temp.nb_login(cg_a);
  SELECT count(*) INTO cnt FROM public.patients WHERE id = child_a;
  PERFORM pg_temp.nb_logout();
  INSERT INTO nb_results (check_name, result)
    VALUES ('Caregiver A can see their own child', CASE WHEN cnt = 1 THEN 'PASS' ELSE 'FAIL' END);

  -- 3. therapist_1 sees no children before any assignment
  PERFORM pg_temp.nb_login(th_1);
  SELECT count(*) INTO cnt FROM public.patients;
  PERFORM pg_temp.nb_logout();
  INSERT INTO nb_results (check_name, result)
    VALUES ('Therapist 1 sees no children before being assigned', CASE WHEN cnt = 0 THEN 'PASS' ELSE 'FAIL' END);

  -- 4. caregiver_a can ask for a specialist for their own child
  BEGIN
    PERFORM pg_temp.nb_login(cg_a);
    INSERT INTO public.requests (child_id, created_by, needs)
      VALUES (child_a, cg_a, ARRAY['occupational_therapy']) RETURNING id INTO req;
    PERFORM pg_temp.nb_logout();
    v := true;
  EXCEPTION WHEN OTHERS THEN
    PERFORM pg_temp.nb_logout(); v := false;
  END;
  INSERT INTO nb_results (check_name, result)
    VALUES ('Caregiver A can request a specialist for their own child', CASE WHEN v THEN 'PASS' ELSE 'FAIL' END);

  -- 5. caregiver_a cannot make a request for Caregiver B's child
  BEGIN
    PERFORM pg_temp.nb_login(cg_a);
    INSERT INTO public.requests (child_id, created_by, needs) VALUES (child_b, cg_a, ARRAY['x']);
    PERFORM pg_temp.nb_logout();
    v := false;
  EXCEPTION WHEN OTHERS THEN
    PERFORM pg_temp.nb_logout(); v := true;
  END;
  INSERT INTO nb_results (check_name, result)
    VALUES ('Caregiver A cannot request for someone else''s child', CASE WHEN v THEN 'PASS' ELSE 'FAIL' END);

  -- 6. caregiver_b cannot see caregiver_a's request
  PERFORM pg_temp.nb_login(cg_b);
  SELECT count(*) INTO cnt FROM public.requests WHERE id = req;
  PERFORM pg_temp.nb_logout();
  INSERT INTO nb_results (check_name, result)
    VALUES ('Caregiver B cannot see Caregiver A''s request', CASE WHEN cnt = 0 THEN 'PASS' ELSE 'FAIL' END);

  -- 7. a caregiver cannot give themselves a role
  BEGIN
    PERFORM pg_temp.nb_login(cg_a);
    INSERT INTO public.user_roles (user_id, role) VALUES (cg_a, 'admin');
    PERFORM pg_temp.nb_logout();
    v := false;
  EXCEPTION WHEN OTHERS THEN
    PERFORM pg_temp.nb_logout(); v := true;
  END;
  INSERT INTO nb_results (check_name, result)
    VALUES ('A caregiver cannot make themselves admin', CASE WHEN v THEN 'PASS' ELSE 'FAIL' END);

  -- 8. a caregiver cannot change their own role
  BEGIN
    PERFORM pg_temp.nb_login(cg_a);
    UPDATE public.user_roles SET role = 'admin' WHERE user_id = cg_a;
    GET DIAGNOSTICS rows_changed = ROW_COUNT;
    PERFORM pg_temp.nb_logout();
    v := (rows_changed = 0);
  EXCEPTION WHEN OTHERS THEN
    PERFORM pg_temp.nb_logout(); v := true;  -- "permission denied" is also a pass
  END;
  INSERT INTO nb_results (check_name, result)
    VALUES ('A caregiver cannot change their own role', CASE WHEN v THEN 'PASS' ELSE 'FAIL' END);

  -- 9. a caregiver cannot hand their child to a therapist
  BEGIN
    PERFORM pg_temp.nb_login(cg_a);
    UPDATE public.patients SET therapist_id = th_1 WHERE id = child_a;
    PERFORM pg_temp.nb_logout();
    v := false;
  EXCEPTION WHEN OTHERS THEN
    PERFORM pg_temp.nb_logout(); v := (SQLERRM LIKE 'Only an admin%');
  END;
  INSERT INTO nb_results (check_name, result)
    VALUES ('A caregiver cannot attach their child to a therapist', CASE WHEN v THEN 'PASS' ELSE 'FAIL' END);

  -- 10. an unverified therapist cannot verify themselves
  PERFORM pg_temp.nb_login(th_2);
  UPDATE public.therapists SET verified = true, clinic_name = 'Renamed' WHERE user_id = th_2;
  PERFORM pg_temp.nb_logout();
  SELECT verified INTO v FROM public.therapists WHERE user_id = th_2;
  INSERT INTO nb_results (check_name, result)
    VALUES ('A therapist cannot verify themselves', CASE WHEN v = false THEN 'PASS' ELSE 'FAIL' END);

  -- 11. an unverified therapist cannot be assigned a request
  BEGIN
    PERFORM pg_temp.nb_login(adm);
    UPDATE public.requests SET assigned_therapist_id = th_2, status = 'matched', approved_by = adm WHERE id = req;
    PERFORM pg_temp.nb_logout();
    v := false;
  EXCEPTION WHEN OTHERS THEN
    PERFORM pg_temp.nb_logout(); v := true;
  END;
  INSERT INTO nb_results (check_name, result)
    VALUES ('An unverified therapist cannot be given a request', CASE WHEN v THEN 'PASS' ELSE 'FAIL' END);

  -- 12. admin can match the request to the verified therapist
  BEGIN
    PERFORM pg_temp.nb_login(adm);
    UPDATE public.requests SET assigned_therapist_id = th_1, status = 'matched', approved_by = adm WHERE id = req;
    GET DIAGNOSTICS rows_changed = ROW_COUNT;
    PERFORM pg_temp.nb_logout();
    v := (rows_changed = 1);
  EXCEPTION WHEN OTHERS THEN
    PERFORM pg_temp.nb_logout(); v := false;
  END;
  INSERT INTO nb_results (check_name, result)
    VALUES ('Admin can match a request to a verified therapist', CASE WHEN v THEN 'PASS' ELSE 'FAIL' END);

  -- 13. after assignment therapist_1 sees only that child
  PERFORM pg_temp.nb_login(th_1);
  SELECT count(*) INTO cnt FROM public.patients;
  PERFORM pg_temp.nb_logout();
  INSERT INTO nb_results (check_name, result)
    VALUES ('Therapist 1 sees only the assigned child', CASE WHEN cnt = 1 THEN 'PASS' ELSE 'FAIL' END);

  -- 14. therapist_2 still sees none
  PERFORM pg_temp.nb_login(th_2);
  SELECT count(*) INTO cnt FROM public.patients;
  PERFORM pg_temp.nb_logout();
  INSERT INTO nb_results (check_name, result)
    VALUES ('Therapist 2 still sees no children', CASE WHEN cnt = 0 THEN 'PASS' ELSE 'FAIL' END);

  -- 15. therapist_1 cannot edit the request details, only answer it
  BEGIN
    PERFORM pg_temp.nb_login(th_1);
    UPDATE public.requests SET needs = ARRAY['changed'] WHERE id = req;
    PERFORM pg_temp.nb_logout();
    v := false;
  EXCEPTION WHEN OTHERS THEN
    PERFORM pg_temp.nb_logout(); v := true;
  END;
  INSERT INTO nb_results (check_name, result)
    VALUES ('A therapist cannot edit request details', CASE WHEN v THEN 'PASS' ELSE 'FAIL' END);

  -- 16. therapist_1 can accept the request
  BEGIN
    PERFORM pg_temp.nb_login(th_1);
    UPDATE public.requests SET status = 'accepted' WHERE id = req;
    GET DIAGNOSTICS rows_changed = ROW_COUNT;
    PERFORM pg_temp.nb_logout();
    v := (rows_changed = 1);
  EXCEPTION WHEN OTHERS THEN
    PERFORM pg_temp.nb_logout(); v := false;
  END;
  INSERT INTO nb_results (check_name, result)
    VALUES ('The assigned verified therapist can accept', CASE WHEN v THEN 'PASS' ELSE 'FAIL' END);

  -- 17. therapist_2 cannot touch the request at all
  PERFORM pg_temp.nb_login(th_2);
  UPDATE public.requests SET status = 'completed' WHERE id = req;
  GET DIAGNOSTICS rows_changed = ROW_COUNT;
  PERFORM pg_temp.nb_logout();
  INSERT INTO nb_results (check_name, result)
    VALUES ('Another therapist cannot change the request', CASE WHEN rows_changed = 0 THEN 'PASS' ELSE 'FAIL' END);

  -- 18. a therapist cannot give a child to another caregiver
  INSERT INTO public.patients (child_name, claim_code, therapist_id)
    VALUES ('Child T', public.generate_claim_code(), th_1);
  BEGIN
    PERFORM pg_temp.nb_login(th_1);
    UPDATE public.patients SET claimed_by_caregiver_id = cg_b WHERE therapist_id = th_1;
    PERFORM pg_temp.nb_logout();
    v := false;
  EXCEPTION WHEN OTHERS THEN
    PERFORM pg_temp.nb_logout(); v := (SQLERRM LIKE 'Only an admin%');
  END;
  INSERT INTO nb_results (check_name, result)
    VALUES ('A therapist cannot hand a child to another caregiver', CASE WHEN v THEN 'PASS' ELSE 'FAIL' END);

  -- 19. a caregiver typing /admin data: no admin powers over other people's data
  PERFORM pg_temp.nb_login(cg_a);
  SELECT count(*) INTO cnt FROM public.profiles WHERE id <> cg_a;
  PERFORM pg_temp.nb_logout();
  INSERT INTO nb_results (check_name, result)
    VALUES ('A caregiver cannot read other people''s profiles', CASE WHEN cnt = 0 THEN 'PASS' ELSE 'FAIL' END);

  -- 20. admin sees everything needed to coordinate
  PERFORM pg_temp.nb_login(adm);
  SELECT count(*) INTO cnt FROM public.patients WHERE claimed_by_caregiver_id IN (cg_a, cg_b) OR therapist_id = th_1;
  PERFORM pg_temp.nb_logout();
  INSERT INTO nb_results (check_name, result)
    VALUES ('Admin can see all children', CASE WHEN cnt = 3 THEN 'PASS' ELSE 'FAIL' END);

  -- 21. logged-out visitors get nothing
  BEGIN
    PERFORM pg_temp.nb_login(NULL, 'anon');
    SELECT count(*) INTO cnt FROM public.patients;
    PERFORM pg_temp.nb_logout();
    v := (cnt = 0);
  EXCEPTION WHEN OTHERS THEN
    PERFORM pg_temp.nb_logout(); v := true;  -- "permission denied" is also a pass
  END;
  INSERT INTO nb_results (check_name, result)
    VALUES ('Logged-out visitors cannot read children', CASE WHEN v THEN 'PASS' ELSE 'FAIL' END);

  BEGIN
    PERFORM pg_temp.nb_login(NULL, 'anon');
    SELECT count(*) INTO cnt FROM public.requests;
    PERFORM pg_temp.nb_logout();
    v := (cnt = 0);
  EXCEPTION WHEN OTHERS THEN
    PERFORM pg_temp.nb_logout(); v := true;
  END;
  INSERT INTO nb_results (check_name, result)
    VALUES ('Logged-out visitors cannot read requests', CASE WHEN v THEN 'PASS' ELSE 'FAIL' END);
END $$;

SELECT pg_temp.nb_cleanup();

SELECT n AS "#", check_name AS "Check", result AS "Result" FROM nb_results ORDER BY n;
