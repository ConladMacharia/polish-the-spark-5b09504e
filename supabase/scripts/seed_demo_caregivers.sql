-- =====================================================================
-- DEMO CAREGIVERS  (fake families, for testing only)
-- 12 caregivers, each with one child, spread across Kenya.
-- 10 of them have a waiting specialist request, so Admin > Matching
-- has plenty to pair with therapists (Davos and the demo therapists).
-- They cannot log in (no password). Safe to run twice.
-- Remove them with supabase/scripts/remove_demo_caregivers.sql
-- =====================================================================

DROP TABLE IF EXISTS pg_temp.demo_c;
CREATE TEMP TABLE demo_c (
  n int, parent text, phone text, child text, years int, gmfcs public.gmfcs_level,
  side public.affected_side, county text, sub_county text, ward text,
  needs text[], funder text, note text, wants_request boolean
);

INSERT INTO demo_c VALUES
 (1,  'Wanjiku Mwangi',  '0711 000 001', 'Amani',     4, 'II',  'left',      'Nairobi',      'Dagoretti North', 'Kilimani',
      ARRAY['occupational_therapy'], 'self',   'Mornings are best for us.', true),
 (2,  'Joseph Kamau',    '0711 000 002', 'Baraka',    6, 'III', 'right',     'Kiambu',       'Ruiru',           'Biashara',
      ARRAY['occupational_therapy','splints_orthotics'], 'county', 'He needs help holding a spoon.', true),
 (3,  'Fatma Said',      '0711 000 003', 'Zawadi',    3, 'IV',  'bilateral', 'Mombasa',      'Likoni',          'Mtongwe',
      ARRAY['physiotherapy'], 'ngo', NULL, true),
 (4,  'Rose Adhiambo',   '0711 000 004', 'Imani',     7, 'II',  'left',      'Kisumu',       'Kisumu East',     'Kolwa Central',
      ARRAY['occupational_therapy','mobility_seating'], 'self', 'We can host visits on weekends.', true),
 (5,  'Peter Kiplagat',  '0711 000 005', 'Kiplangat', 5, 'III', 'right',     'Uasin Gishu',  'Turbo',           'Huruma',
      ARRAY['physiotherapy'], 'county', NULL, true),
 (6,  'Mary Njoki',      '0711 000 006', 'Neema',     8, 'V',   'bilateral', 'Nyeri',        'Nyeri Central',   'Rware',
      ARRAY['mobility_seating','physiotherapy'], 'ngo', 'Needs a better seat for school.', true),
 (7,  'Daniel Mutua',    '0711 000 007', 'Tumaini',   2, 'II',  'none',      'Machakos',     'Machakos Town',   'Mua',
      ARRAY['speech_swallowing'], 'self', 'Trouble with feeding.', true),
 (8,  'Esther Nafula',   '0711 000 008', 'Khalwale',  9, 'I',   'left',      'Kakamega',     'Lurambi',         'Butsotso East',
      ARRAY['occupational_therapy'], 'county', NULL, true),
 (9,  'Ali Hassan',      '0711 000 009', 'Yusuf',     6, 'IV',  'bilateral', 'Garissa',      'Garissa Township','Waberi',
      ARRAY['physiotherapy','mobility_seating'], 'ngo', NULL, true),
 (10, 'Ekai Lokiru',     '0711 000 010', 'Akai',      5, 'III', 'right',     'Turkana',      'Turkana Central', 'Kanamkemer',
      ARRAY['occupational_therapy','physiotherapy'], 'ngo', 'We live far from the town.', true),
 (11, 'Beatrice Gacheri','0711 000 011', 'Kaburu',    7, 'II',  'left',      'Meru',         'Imenti North',    'Municipality',
      ARRAY['physiotherapy','splints_orthotics'], 'self', NULL, false),
 (12, 'Samson Ochieng',  '0711 000 012', 'Onyango',   4, 'III', 'right',     'Kisii',        'Kitutu Chache South', 'Bobaracho',
      ARRAY['occupational_therapy','splints_orthotics'], 'county', NULL, false);

-- 1) the caregiver accounts (no password, so nobody can log in as them)
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
SELECT
  '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
  format('demo-caregiver-%s@example.invalid', lpad(d.n::text, 2, '0')), '', now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object('role', 'caregiver', 'full_name', d.parent, 'demo', true),
  now(), now(), '', '', '', ''
FROM demo_c d
WHERE NOT EXISTS (
  SELECT 1 FROM auth.users u
  WHERE u.email = format('demo-caregiver-%s@example.invalid', lpad(d.n::text, 2, '0'))
);

UPDATE public.profiles p SET full_name = d.parent, phone = d.phone
FROM demo_c d
JOIN auth.users u ON u.email = format('demo-caregiver-%s@example.invalid', lpad(d.n::text, 2, '0'))
WHERE p.id = u.id;

INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'caregiver'
FROM demo_c d
JOIN auth.users u ON u.email = format('demo-caregiver-%s@example.invalid', lpad(d.n::text, 2, '0'))
ON CONFLICT DO NOTHING;

-- 2) one child each, with location and a (demo) consent date
INSERT INTO public.patients (
  claim_code, claimed_by_caregiver_id, claimed_at, child_name, date_of_birth,
  gmfcs_level, affected_side, county, sub_county, ward, consent_at
)
SELECT
  public.generate_claim_code(), u.id, now(), d.child,
  (current_date - make_interval(years => d.years, months => d.n)), d.gmfcs, d.side,
  d.county, d.sub_county, d.ward, now()
FROM demo_c d
JOIN auth.users u ON u.email = format('demo-caregiver-%s@example.invalid', lpad(d.n::text, 2, '0'))
WHERE NOT EXISTS (SELECT 1 FROM public.patients p WHERE p.claimed_by_caregiver_id = u.id);

-- 3) waiting specialist requests
INSERT INTO public.requests (child_id, created_by, needs, funder, notes, status)
SELECT p.id, u.id, d.needs, d.funder, d.note, 'pending'
FROM demo_c d
JOIN auth.users u ON u.email = format('demo-caregiver-%s@example.invalid', lpad(d.n::text, 2, '0'))
JOIN public.patients p ON p.claimed_by_caregiver_id = u.id
WHERE d.wants_request
  AND NOT EXISTS (
    SELECT 1 FROM public.requests r
    WHERE r.child_id = p.id AND r.status IN ('pending', 'matched', 'accepted')
  );

-- Check
SELECT pr.full_name AS "Caregiver", p.child_name AS "Child", p.county AS "County",
       COALESCE(r.status, 'no request') AS "Request"
FROM public.patients p
JOIN public.profiles pr ON pr.id = p.claimed_by_caregiver_id
LEFT JOIN public.requests r ON r.child_id = p.id
WHERE pr.email LIKE 'demo-caregiver-%@example.invalid'
ORDER BY pr.email;
