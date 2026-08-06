ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ui_language text NOT NULL DEFAULT 'en';
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS ui_language text NOT NULL DEFAULT 'en';