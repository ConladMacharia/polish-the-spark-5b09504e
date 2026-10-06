import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export const VIDEO_BUCKET = "training-videos";
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024; // 50 MB (Supabase default upload cap)
export const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"];

export type ExerciseVideo = Database["public"]["Tables"]["exercise_videos"]["Row"];

/** All uploaded videos, keyed by exercise slug. */
export async function fetchExerciseVideos(): Promise<Record<string, ExerciseVideo>> {
  const { data, error } = await supabase.from("exercise_videos").select("*");
  if (error) throw error;
  return Object.fromEntries((data ?? []).map((v) => [v.slug, v]));
}

/** Short-lived link the <video> tag can play (bucket is private). */
export async function getVideoUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(VIDEO_BUCKET).createSignedUrl(path, 60 * 60);
  if (error || !data) throw error ?? new Error("Could not load the video");
  return data.signedUrl;
}

function guessType(file: File): string {
  if (file.type) return file.type;
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext === "mp4") return "video/mp4";
  if (ext === "webm") return "video/webm";
  if (ext === "mov") return "video/quicktime";
  return "";
}

export function validateVideoFile(file: File): string | null {
  if (!ALLOWED_VIDEO_TYPES.includes(guessType(file))) return "Please choose an MP4, WebM or MOV video";
  if (file.size > MAX_VIDEO_BYTES) {
    return `That video is ${(file.size / 1024 / 1024).toFixed(0)} MB. The limit is 50 MB, so please compress it first.`;
  }
  return null;
}

/** Upload (or replace) the video for one exercise. Admin only (enforced by the database). */
export async function uploadExerciseVideo(
  slug: string,
  file: File,
  existing?: ExerciseVideo,
): Promise<void> {
  const problem = validateVideoFile(file);
  if (problem) throw new Error(problem);

  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id ?? null;

  const ext = (file.name.split(".").pop() || "mp4").toLowerCase().replace(/[^a-z0-9]/g, "");
  const path = `${slug}/${Date.now()}.${ext}`;
  const contentType = guessType(file);

  const { error: upErr } = await supabase.storage
    .from(VIDEO_BUCKET)
    .upload(path, file, { contentType, upsert: false });
  if (upErr) throw new Error(`Could not upload the video: ${upErr.message}`);

  const { error: rowErr } = await supabase.from("exercise_videos").upsert(
    {
      slug,
      storage_path: path,
      file_name: file.name,
      mime_type: contentType,
      size_bytes: file.size,
      uploaded_by: uid,
    },
    { onConflict: "slug" },
  );
  if (rowErr) {
    await supabase.storage.from(VIDEO_BUCKET).remove([path]);
    throw new Error(`Could not save the video: ${rowErr.message}`);
  }

  // Replaced an older video: clean up the old file.
  if (existing?.storage_path && existing.storage_path !== path) {
    await supabase.storage.from(VIDEO_BUCKET).remove([existing.storage_path]);
  }
}

export async function deleteExerciseVideo(video: ExerciseVideo): Promise<void> {
  const { error } = await supabase.from("exercise_videos").delete().eq("slug", video.slug);
  if (error) throw new Error(`Could not remove the video: ${error.message}`);
  await supabase.storage.from(VIDEO_BUCKET).remove([video.storage_path]);
}
