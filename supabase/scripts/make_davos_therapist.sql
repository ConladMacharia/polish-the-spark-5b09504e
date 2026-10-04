-- =====================================================================
-- DAVOS: make sirdavos228@gmail.com a verified therapist, and make sure
-- machariaconlad@gmail.com is the admin.
--
-- BEFORE YOU RUN THIS: sign in to the app ONCE with each Google account
-- (the account has to exist first). Then paste this whole file and Run.
-- Needs supabase/migrations/20261003150000_therapist_profiles.sql run first.
-- Safe to run twice.
-- =====================================================================

DO $$
DECLARE
  davos uuid;
  boss  uuid;
BEGIN
  SELECT id INTO davos FROM auth.users WHERE lower(email) = 'sirdavos228@gmail.com';
  IF davos IS NULL THEN
    RAISE EXCEPTION 'sirdavos228@gmail.com has not signed in to the app yet. Sign in once with that Google account, then run this again.';
  END IF;

  -- Davos is a therapist only (not also a caregiver)
  DELETE FROM public.user_roles WHERE user_id = davos AND role = 'caregiver';
  INSERT INTO public.user_roles (user_id, role) VALUES (davos, 'therapist') ON CONFLICT DO NOTHING;

  UPDATE public.profiles SET full_name = 'Davos' WHERE id = davos;

  -- Edit the values below if you want a different base, radius or speciality.
  INSERT INTO public.therapists (user_id, clinic_name) VALUES (davos, 'Davos Home Therapy')
  ON CONFLICT (user_id) DO NOTHING;

  UPDATE public.therapists SET
    clinic_name     = 'Davos Home Therapy',
    license_number  = 'DEMO-OT-DAVOS',
    country         = 'Kenya',
    city            = 'Nairobi',
    profession      = 'occupational_therapist',
    specializations = ARRAY['occupational_therapy', 'physiotherapy', 'mobility_seating'],
    home_lat        = -1.2921,
    home_lng        = 36.7872,
    radius_km       = 60,
    home_visits     = true,
    available_days  = ARRAY['mon','tue','wed','thu','fri','sat'],
    languages       = ARRAY['en', 'sw'],
    verified        = true
  WHERE user_id = davos;

  -- The admin
  SELECT id INTO boss FROM auth.users WHERE lower(email) = 'machariaconlad@gmail.com';
  IF boss IS NULL THEN
    RAISE NOTICE 'machariaconlad@gmail.com has not signed in yet, so it could not be made admin.';
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (boss, 'admin') ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- Check
SELECT u.email, string_agg(r.role::text, ', ' ORDER BY r.role::text) AS roles
FROM auth.users u LEFT JOIN public.user_roles r ON r.user_id = u.id
WHERE lower(u.email) IN ('sirdavos228@gmail.com', 'machariaconlad@gmail.com')
GROUP BY u.email;

SELECT p.full_name AS "Name", t.profession AS "Profession", t.city AS "Base",
       t.radius_km AS "Radius km", t.verified AS "Verified"
FROM public.therapists t JOIN public.profiles p ON p.id = t.user_id
WHERE lower(p.email) = 'sirdavos228@gmail.com';
