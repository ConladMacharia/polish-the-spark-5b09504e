ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS age_years integer,
  ADD COLUMN IF NOT EXISTS cp_type text,
  ADD COLUMN IF NOT EXISTS macs_level text,
  ADD COLUMN IF NOT EXISTS mobility text;