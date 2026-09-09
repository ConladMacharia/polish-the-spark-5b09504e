import { useCallback, useEffect } from "react";

import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { promptPlayer } from "./promptPlayer";

/**
 * Hook for the live session: plays a recorded prompt by code in the language
 * the app is currently displayed in, and mirrors the text into a banner.
 */
export function useVoicePrompts(
  banner?: (text: string, ms: number) => void,
) {
  const { lang } = useLanguage();

  useEffect(() => {
    promptPlayer.setLanguageResolver(() => lang);
  }, [lang]);

  useEffect(() => () => promptPlayer.stopAll(), []);

  const cue = useCallback(
    (code: string, vars?: Record<string, string | number>) => {
      promptPlayer.play(code, { vars, banner });
    },
    [banner],
  );

  const unlock = useCallback(() => promptPlayer.unlock(), []);
  const stop = useCallback(() => promptPlayer.stopAll(), []);

  return { cue, unlock, stop };
}
