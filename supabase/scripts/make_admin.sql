-- =====================================================================
-- Run in the Supabase SQL Editor. Replace the emails, then click Run.
-- Admins are NEVER made through the app, only here.
-- =====================================================================

-- 1) Make yourself the admin (the account must already exist: sign up first)
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin' FROM auth.users WHERE email = 'YOUR-EMAIL@example.com'
ON CONFLICT DO NOTHING;

-- 2) Optional: verify a therapist by email (you can also do this in the Admin screen)
UPDATE public.therapists SET verified = true
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'THERAPIST-EMAIL@example.com');

-- Check who is what
SELECT u.email, r.role
FROM public.user_roles r JOIN auth.users u ON u.id = r.user_id
ORDER BY r.role, u.email;
