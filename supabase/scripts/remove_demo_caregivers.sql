-- Removes ONLY the 12 demo caregivers made by seed_demo_caregivers.sql,
-- together with their children and requests.
DELETE FROM public.requests WHERE created_by IN
  (SELECT id FROM auth.users WHERE email LIKE 'demo-caregiver-%@example.invalid');
DELETE FROM public.patients WHERE claimed_by_caregiver_id IN
  (SELECT id FROM auth.users WHERE email LIKE 'demo-caregiver-%@example.invalid');
DELETE FROM auth.users WHERE email LIKE 'demo-caregiver-%@example.invalid';
SELECT count(*) AS "demo caregivers left" FROM auth.users WHERE email LIKE 'demo-caregiver-%@example.invalid';
