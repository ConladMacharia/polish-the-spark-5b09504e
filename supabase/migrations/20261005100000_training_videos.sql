-- =====================================================================
-- Training videos: one demo video per exercise, uploaded by an admin.
--  * private storage bucket "training-videos" (signed in, any role, can watch)
--  * table exercise_videos: which file belongs to which exercise slug
--  * only admins can upload, replace or remove videos
-- Files live at: training-videos/<exercise slug>/<timestamp>.<ext>
-- =====================================================================

-- ---------- 1. private bucket ----------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('training-videos', 'training-videos', false, 52428800,
        ARRAY['video/mp4', 'video/webm', 'video/quicktime'])
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY['video/mp4', 'video/webm', 'video/quicktime'];

DROP POLICY IF EXISTS "training videos read" ON storage.objects;
CREATE POLICY "training videos read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'training-videos');

DROP POLICY IF EXISTS "training videos admin insert" ON storage.objects;
CREATE POLICY "training videos admin insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'training-videos' AND public.is_admin());

DROP POLICY IF EXISTS "training videos admin update" ON storage.objects;
CREATE POLICY "training videos admin update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'training-videos' AND public.is_admin())
  WITH CHECK (bucket_id = 'training-videos' AND public.is_admin());

DROP POLICY IF EXISTS "training videos admin delete" ON storage.objects;
CREATE POLICY "training videos admin delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'training-videos' AND public.is_admin());

-- ---------- 2. which video belongs to which exercise ----------
CREATE TABLE IF NOT EXISTS public.exercise_videos (
  slug text PRIMARY KEY,
  storage_path text NOT NULL,
  file_name text,
  mime_type text,
  size_bytes bigint,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT exercise_videos_slug_check CHECK (slug ~ '^[a-z0-9-]{1,80}$')
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.exercise_videos TO authenticated;
GRANT ALL ON public.exercise_videos TO service_role;
ALTER TABLE public.exercise_videos ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_exercise_videos_updated_at ON public.exercise_videos;
CREATE TRIGGER trg_exercise_videos_updated_at BEFORE UPDATE ON public.exercise_videos
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

DROP POLICY IF EXISTS "exercise videos read" ON public.exercise_videos;
CREATE POLICY "exercise videos read" ON public.exercise_videos FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "exercise videos admin insert" ON public.exercise_videos;
CREATE POLICY "exercise videos admin insert" ON public.exercise_videos FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "exercise videos admin update" ON public.exercise_videos;
CREATE POLICY "exercise videos admin update" ON public.exercise_videos FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "exercise videos admin delete" ON public.exercise_videos;
CREATE POLICY "exercise videos admin delete" ON public.exercise_videos FOR DELETE TO authenticated
  USING (public.is_admin());
