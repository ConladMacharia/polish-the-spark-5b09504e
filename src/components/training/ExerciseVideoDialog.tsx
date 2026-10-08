import { useQuery } from "@tanstack/react-query";
import { Loader2, VideoOff } from "lucide-react";

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { getVideoUrl, type ExerciseVideo } from "@/lib/training-videos";
import { useLanguage } from "@/lib/i18n/LanguageProvider";

/** Pop-up player for one exercise's demo video. */
export function ExerciseVideoDialog({
  open,
  onOpenChange,
  name,
  focus,
  video,
  onStartTracking,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  name: string;
  focus?: string;
  video?: ExerciseVideo;
  onStartTracking: () => void;
}) {
  const { t } = useLanguage();
  const { data: url, isLoading, isError } = useQuery({
    queryKey: ["exercise-video-url", video?.storage_path],
    queryFn: () => getVideoUrl(video!.storage_path),
    enabled: open && !!video,
    staleTime: 50 * 60 * 1000, // signed link lasts 60 min
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl border-white/15 bg-emerald-950 p-4 text-stone-50 sm:p-6">
        {focus && (
          <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-300">
            {focus}
          </p>
        )}
        <DialogTitle className="font-display text-xl font-bold">{name}</DialogTitle>
        <DialogDescription className="sr-only">Demonstration video for {name}</DialogDescription>

        <div className="overflow-hidden rounded-2xl bg-black">
          {!video ? (
            <div className="flex aspect-video flex-col items-center justify-center gap-2 text-stone-400">
              <VideoOff className="h-8 w-8" />
              <p className="text-sm font-semibold">{t("uiVideoSoon")}</p>
            </div>
          ) : isLoading ? (
            <div className="flex aspect-video items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-emerald-300" />
            </div>
          ) : isError || !url ? (
            <div className="flex aspect-video items-center justify-center text-sm text-red-300">
              {t("uiVideoError")}
            </div>
          ) : (
            <video
              key={url}
              src={url}
              controls
              playsInline
              preload="metadata"
              className="aspect-video w-full"
            />
          )}
        </div>

        <button
          type="button"
          onClick={onStartTracking}
          className="mt-1 rounded-full bg-emerald-300 px-5 py-3 text-sm font-bold text-emerald-950"
        >
          {t("uiStartTracking")}
        </button>
      </DialogContent>
    </Dialog>
  );
}
