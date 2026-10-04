import { useEffect } from "react";

/** Turns the champagne + emerald-ink admin theme on while the caller is on screen. */
export function useAdminTheme() {
  useEffect(() => {
    document.documentElement.classList.add("theme-nb-admin");
    return () => document.documentElement.classList.remove("theme-nb-admin");
  }, []);
}
