-- =====================================================================
-- DEMO THERAPISTS  (fake people, for testing only)
-- 14 therapists across Kenya: different professions, specialities,
-- home bases, work radius, days and languages.
--   * 12 are VERIFIED  (they show up in Admin > Matching)
--   * 2 are PENDING    (they show up in Admin > Verification)
-- They cannot log in (no password). Safe to run twice.
-- Run supabase/migrations/20261003150000_therapist_profiles.sql FIRST.
-- Remove them all with supabase/scripts/remove_demo_therapists.sql
-- =====================================================================

DROP TABLE IF EXISTS pg_temp.demo_t;
CREATE TEMP TABLE demo_t (
  n int, full_name text, phone text, clinic text, license text, city text,
  profession text, specs text[], lat double precision, lng double precision,
  radius int, home_visits boolean, days text[], langs text[], verified boolean
);

INSERT INTO demo_t VALUES
 (1,  'Grace Wanjiru',   '0700 000 001', 'Westlands Child Therapy (demo)',   'DEMO-OT-001',  'Nairobi',
      'occupational_therapist', ARRAY['occupational_therapy','splints_orthotics'], -1.2634, 36.8028, 25, true,
      ARRAY['mon','tue','wed','thu','fri'], ARRAY['en','sw','ki'], true),
 (2,  'Brian Otieno',    '0700 000 002', 'Embakasi Physio Home Care (demo)', 'DEMO-PT-002',  'Nairobi',
      'physiotherapist', ARRAY['physiotherapy','mobility_seating'], -1.3190, 36.9000, 30, true,
      ARRAY['mon','wed','fri','sat'], ARRAY['en','sw','luo'], true),
 (3,  'Faith Njeri',     '0700 000 003', 'Thika Kids Rehab (demo)',          'DEMO-OT-003',  'Thika',
      'occupational_therapist', ARRAY['occupational_therapy'], -1.0396, 37.0834, 40, true,
      ARRAY['mon','tue','wed','thu','fri','sat'], ARRAY['en','sw','ki'], true),
 (4,  'Hassan Abdalla',  '0700 000 004', 'Coast Physio Visits (demo)',       'DEMO-PT-004',  'Mombasa',
      'physiotherapist', ARRAY['physiotherapy'], -4.0435, 39.6682, 35, true,
      ARRAY['mon','tue','wed','thu','fri','sat'], ARRAY['en','sw','mij'], true),
 (5,  'Mercy Achieng',   '0700 000 005', 'Lakeside Child Development (demo)','DEMO-OT-005',  'Kisumu',
      'occupational_therapist', ARRAY['occupational_therapy','mobility_seating'], -0.0917, 34.7680, 50, true,
      ARRAY['mon','tue','wed','thu','fri'], ARRAY['en','sw','luo'], true),
 (6,  'Kevin Kiprop',    '0700 000 006', 'Eldoret Mobility Clinic (demo)',   'DEMO-PT-006',  'Eldoret',
      'physiotherapist', ARRAY['physiotherapy','splints_orthotics'], 0.5143, 35.2698, 60, true,
      ARRAY['mon','tue','wed','thu','fri'], ARRAY['en','sw','kln'], true),
 (7,  'Lucy Wambui',     '0700 000 007', 'Nakuru Speech and Feeding (demo)', 'DEMO-SLT-007', 'Nakuru',
      'speech_language_therapist', ARRAY['speech_swallowing'], -0.3031, 36.0800, 45, true,
      ARRAY['tue','thu','sat'], ARRAY['en','sw','ki'], true),
 (8,  'Peter Mwangi',    '0700 000 008', 'Nyeri Orthotics Workshop (demo)',  'DEMO-ORT-008', 'Nyeri',
      'orthotist', ARRAY['splints_orthotics','mobility_seating'], -0.4201, 36.9476, 70, true,
      ARRAY['mon','tue','wed','thu','fri'], ARRAY['en','sw','ki'], true),
 (9,  'Joyce Mutheu',    '0700 000 009', 'Machakos Little Steps (demo)',     'DEMO-OT-009',  'Machakos',
      'occupational_therapist', ARRAY['occupational_therapy'], -1.5177, 37.2634, 40, true,
      ARRAY['mon','tue','thu'], ARRAY['en','sw','kam'], true),
 (10, 'Dennis Wekesa',   '0700 000 010', 'Kakamega Home Physio (demo)',      'DEMO-PT-010',  'Kakamega',
      'physiotherapist', ARRAY['physiotherapy'], 0.2827, 34.7519, 45, true,
      ARRAY['mon','tue','wed','thu','fri','sat'], ARRAY['en','sw','luy'], true),
 (11, 'Naomi Moraa',     '0700 000 011', 'Kisii Child Clinic (demo)',        'DEMO-OT-011',  'Kisii',
      'occupational_therapist', ARRAY['occupational_therapy','splints_orthotics'], -0.6817, 34.7667, 35, false,
      ARRAY['mon','tue','wed','thu','fri'], ARRAY['en','sw','kis'], true),
 (12, 'Abdi Hussein',    '0700 000 012', 'Garissa Mobility Outreach (demo)', 'DEMO-PT-012',  'Garissa',
      'physiotherapist', ARRAY['physiotherapy','mobility_seating'], -0.4532, 39.6461, 120, true,
      ARRAY['mon','tue','wed','thu'], ARRAY['en','sw','som'], true),
 (13, 'Esther Ekai',     '0700 000 013', 'Turkana Rehab Outreach (demo)',    'DEMO-OT-013',  'Lodwar',
      'occupational_therapist', ARRAY['occupational_therapy','physiotherapy'], 3.1191, 35.5973, 250, true,
      ARRAY['mon','tue','wed','thu','fri'], ARRAY['en','sw','tur'], false),
 (14, 'Samuel Gitonga',  '0700 000 014', 'Meru Physio Care (demo)',          'DEMO-PT-014',  'Meru',
      'physiotherapist', ARRAY['physiotherapy','splints_orthotics'], 0.0467, 37.6559, 55, true,
      ARRAY['mon','tue','wed','thu','fri','sat'], ARRAY['en','sw','mer'], false);

-- 1) the sign-in accounts (no password, so nobody can log in as them)
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
SELECT
  '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
  format('demo-therapist-%s@example.invalid', lpad(d.n::text, 2, '0')), '', now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object('role', 'therapist', 'full_name', d.full_name, 'clinic_name', d.clinic, 'demo', true),
  now(), now(), '', '', '', ''
FROM demo_t d
WHERE NOT EXISTS (
  SELECT 1 FROM auth.users u
  WHERE u.email = format('demo-therapist-%s@example.invalid', lpad(d.n::text, 2, '0'))
);

-- 2) their therapist details
INSERT INTO public.therapists (user_id, clinic_name)
SELECT u.id, d.clinic
FROM demo_t d
JOIN auth.users u ON u.email = format('demo-therapist-%s@example.invalid', lpad(d.n::text, 2, '0'))
ON CONFLICT (user_id) DO NOTHING;

UPDATE public.therapists t SET
  clinic_name = d.clinic, license_number = d.license, country = 'Kenya', city = d.city,
  profession = d.profession, specializations = d.specs,
  home_lat = d.lat, home_lng = d.lng, radius_km = d.radius, home_visits = d.home_visits,
  available_days = d.days, languages = d.langs, verified = d.verified
FROM demo_t d
JOIN auth.users u ON u.email = format('demo-therapist-%s@example.invalid', lpad(d.n::text, 2, '0'))
WHERE t.user_id = u.id;

UPDATE public.profiles p SET full_name = d.full_name, phone = d.phone
FROM demo_t d
JOIN auth.users u ON u.email = format('demo-therapist-%s@example.invalid', lpad(d.n::text, 2, '0'))
WHERE p.id = u.id;

INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'therapist'
FROM demo_t d
JOIN auth.users u ON u.email = format('demo-therapist-%s@example.invalid', lpad(d.n::text, 2, '0'))
ON CONFLICT DO NOTHING;

-- Check
SELECT p.full_name AS "Name", t.city AS "Base", t.profession AS "Profession",
       t.radius_km AS "Radius km", t.home_visits AS "Home visits",
       CASE WHEN t.verified THEN 'verified' ELSE 'pending' END AS "Status"
FROM public.therapists t JOIN public.profiles p ON p.id = t.user_id
WHERE p.email LIKE 'demo-therapist-%@example.invalid'
ORDER BY p.email;
