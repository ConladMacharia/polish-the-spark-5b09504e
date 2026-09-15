ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS best_angle_deg smallint,
  ADD COLUMN IF NOT EXISTS side text;