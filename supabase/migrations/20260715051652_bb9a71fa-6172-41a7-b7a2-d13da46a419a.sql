
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS exercise_slug TEXT;
ALTER TYPE public.exercise_type ADD VALUE IF NOT EXISTS 'occupational';
