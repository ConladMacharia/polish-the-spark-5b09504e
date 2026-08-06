import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { EN_STRINGS, type StringBundle, type StringKey } from "./strings";
import { LANGUAGES, LANGUAGE_STORAGE_KEY, getLanguage, toDbLanguage } from "./languages";

const modules = import.meta.glob<{ default: StringBundle }>("./locales/*.json", { eager: true });

const BUNDLES: Record<string, StringBundle> = {};
for (const path in modules) {
  const code = path.split("/").pop()!.replace(".json", "");
  BUNDLES[code] = modules[path].default;
}

function resolve(code: string, key: StringKey): string {
  const voice = getLanguage(code).voice;
  const chain = [code, voice === "en-US" ? "en" : "sw", "en"];
  for (const c of chain) {
    const v = BUNDLES[c]?.[key];
    if (typeof v === "string" && v.trim()) return v;
  }
  return EN_STRINGS[key];
}

function format(template: string, vars?: Record<string, string | number>) {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (m, k) =>
    vars[k] !== undefined ? String(vars[k]) : m,
  );
}

interface LanguageContextValue {
  lang: string;
  setLanguage: (code: string) => void;
  t: (key: StringKey, vars?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextValue>({
  lang: "en",
  setLanguage: () => {},
  t: (key, vars) => format(EN_STRINGS[key], vars),
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState("en");

  // Hydrate after mount (avoids SSR mismatch): localStorage → profile → device.
  useEffect(() => {
    const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (stored && LANGUAGES.some((l) => l.code === stored)) {
      setLang(stored);
    } else {
      const device = navigator.language?.split("-")[0];
      if (device && LANGUAGES.some((l) => l.code === device)) setLang(device);
    }

    let cancelled = false;
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user || cancelled) return;
      const { data } = await supabase
        .from("profiles")
        .select("ui_language")
        .eq("id", userData.user.id)
        .maybeSingle();
      const remote = (data as { ui_language?: string | null } | null)?.ui_language;
      if (!cancelled && remote && LANGUAGES.some((l) => l.code === remote)) {
        setLang(remote);
        localStorage.setItem(LANGUAGE_STORAGE_KEY, remote);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLanguage = useCallback((code: string) => {
    setLang(code);
    localStorage.setItem(LANGUAGE_STORAGE_KEY, code);
    void (async () => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) return;
      await supabase
        .from("profiles")
        .update({
          ui_language: code,
          preferred_language: toDbLanguage(code),
        } as never)
        .eq("id", uid);
      await supabase
        .from("patients")
        .update({
          ui_language: code,
          preferred_language: toDbLanguage(code),
        } as never)
        .eq("claimed_by_caregiver_id", uid);
    })();
  }, []);

  const value = useMemo<LanguageContextValue>(
    () => ({
      lang,
      setLanguage,
      t: (key, vars) => format(resolve(lang, key), vars),
    }),
    [lang, setLanguage],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  return useContext(LanguageContext);
}

export function useT() {
  return useContext(LanguageContext).t;
}
