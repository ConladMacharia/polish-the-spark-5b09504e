-- Removes ONLY the 14 demo therapists made by seed_demo_therapists.sql.
DELETE FROM auth.users WHERE email LIKE 'demo-therapist-%@example.invalid';
SELECT count(*) AS "demo therapists left" FROM auth.users WHERE email LIKE 'demo-therapist-%@example.invalid';
