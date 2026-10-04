-- =====================================================================
-- Therapist profiles (plan section 5): what a therapist offers and where.
--  * new columns: profession, specializations, home base, radius, days, languages
--  * FIX: signing up as a therapist now creates their therapist row, so they
--    appear in the admin Verification queue (before, nobody ever did)
-- =====================================================================

ALTER TABLE public.therapists
  ADD COLUMN IF NOT EXISTS profession text,
  ADD COLUMN IF NOT EXISTS specializations text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS home_lat double precision,
  ADD COLUMN IF NOT EXISTS home_lng double precision,
  ADD COLUMN IF NOT EXISTS radius_km integer,
  ADD COLUMN IF NOT EXISTS home_visits boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS available_days text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS languages text[] NOT NULL DEFAULT '{}';

ALTER TABLE public.therapists DROP CONSTRAINT IF EXISTS therapists_profession_check;
ALTER TABLE public.therapists ADD CONSTRAINT therapists_profession_check
  CHECK (profession IS NULL OR profession IN
    ('occupational_therapist', 'physiotherapist', 'speech_language_therapist', 'orthotist'));

ALTER TABLE public.therapists DROP CONSTRAINT IF EXISTS therapists_radius_check;
ALTER TABLE public.therapists ADD CONSTRAINT therapists_radius_check
  CHECK (radius_km IS NULL OR radius_km BETWEEN 1 AND 500);

ALTER TABLE public.therapists DROP CONSTRAINT IF EXISTS therapists_home_lat_check;
ALTER TABLE public.therapists ADD CONSTRAINT therapists_home_lat_check
  CHECK (home_lat IS NULL OR home_lat BETWEEN -90 AND 90);
ALTER TABLE public.therapists DROP CONSTRAINT IF EXISTS therapists_home_lng_check;
ALTER TABLE public.therapists ADD CONSTRAINT therapists_home_lng_check
  CHECK (home_lng IS NULL OR home_lng BETWEEN -180 AND 180);

-- Sign-up: same as before, plus a therapist row for therapists.
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

  -- assign role from signup metadata (therapist or caregiver; never admin)
  IF NEW.raw_user_meta_data->>'role' IN ('therapist', 'caregiver') THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, (NEW.raw_user_meta_data->>'role')::public.app_role)
    ON CONFLICT DO NOTHING;
  END IF;

  -- a therapist starts as "pending" until an admin verifies them
  IF NEW.raw_user_meta_data->>'role' = 'therapist' THEN
    INSERT INTO public.therapists (user_id, clinic_name)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'clinic_name', ''))
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- Therapists who already signed up but have no row yet.
INSERT INTO public.therapists (user_id, clinic_name)
SELECT ur.user_id, ''
FROM public.user_roles ur
WHERE ur.role = 'therapist'
  AND NOT EXISTS (SELECT 1 FROM public.therapists t WHERE t.user_id = ur.user_id)
ON CONFLICT (user_id) DO NOTHING;
