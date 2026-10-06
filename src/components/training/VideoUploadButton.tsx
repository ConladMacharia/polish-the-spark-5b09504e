import { useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

import {
  deleteExerciseVideo,
  uploadExerciseVideo,
  type ExerciseVideo,
} from "@/lib/training-videos";

/**
 * Admin-only control shown on each exercise card:
 * pick a video from your computer to upload (or replace), or remove it.
 */
export function VideoUploadButton({
  slug,
  video,
}: {
  slug: string;
  video?: ExerciseVideo;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();

  const upload = useMutation({
    mutationFn: (file: File) => uploadExerciseVideo(slug, file, video),
    onSuccess: () => {
      toast.success(video ? "Video replaced" : "Video uploaded");
      qc.invalidateQueries({ queryKey: ["exercise-videos"] });
      qc.invalidateQueries({ queryKey: ["exercise-video-url"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: () => deleteExerciseVideo(video!),
    onSuccess: () => {
      toast.success("Video removed");
      qc.invalidateQueries({ queryKey: ["exercise-videos"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const busy = upload.isPending || remove.isPending;

  return (
    <div className="flex items-center gap-1.5">
      <input
        ref={inputRef}
        type="file"
        accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = ""; // allow picking the same file again
          if (file) upload.mutate(file);
        }}
      />
      <button
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        className="flex items-center gap-1 rounded-full border border-white/20 bg-black/50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-200 backdrop-blur-xl disabled:opacity-60"
      >
        {upload.isPending ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <Upload className="h-3 w-3" />
        )}
        {upload.isPending ? "Uploading…" : video ? "Replace" : "Upload video"}
      </button>
      {video && (
        <button
          type="button"
          disabled={busy}
          aria-label="Remove video"
          onClick={() => {
            if (window.confirm("Remove this video?")) remove.mutate();
          }}
          className="grid h-6 w-6 place-items-center rounded-full border border-white/20 bg-black/50 text-red-300 backdrop-blur-xl disabled:opacity-60"
        >
          {remove.isPending ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Trash2 className="h-3 w-3" />
          )}
        </button>
      )}
    </div>
  );
}
