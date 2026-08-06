import { useMemo, useState } from "react";
import { Check, Globe, Search, Settings } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LANGUAGES, CURATED_LANGUAGES } from "@/lib/i18n/languages";
import { translateIn, useLanguage } from "@/lib/i18n/LanguageProvider";

export function LanguageSettings() {
  const { lang, setLanguage, t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const active = LANGUAGES.find((l) => l.code === lang) ?? LANGUAGES[0];

  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return LANGUAGES;
    return LANGUAGES.filter(
      (l) =>
        l.name.toLowerCase().includes(term) ||
        l.native.toLowerCase().includes(term) ||
        l.code.includes(term),
    );
  }, [q]);

  function pick(code: string) {
    setLanguage(code);
    const picked = LANGUAGES.find((l) => l.code === code);
    toast.success(translateIn(code, "languageChanged", { lang: picked?.native ?? code }));
    setOpen(false);
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        aria-label={t("settings")}
        className="gap-2"
      >
        <Settings className="h-4 w-4" />
        <span className="text-xs font-bold uppercase tracking-wide">{active.code}</span>
      </Button>

      {open && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-950/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-t-3xl border-3 border-slate-950 bg-card p-6 shadow-2xl sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border-2 border-slate-950 bg-sky-200">
                <Globe className="h-5 w-5 text-slate-900" />
              </div>
              <div>
                <h2 className="font-display text-2xl font-bold leading-none">{t("language")}</h2>
                <p className="mt-1.5 text-xs font-semibold text-muted-foreground">
                  {t("languageSubtitle")}
                </p>
              </div>
            </div>

            <div className="relative mt-4">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t("searchLanguage")}
                className="rounded-xl border-2 border-slate-900 pl-9 font-medium shadow-[2px_2px_0px_#0f172a]"
              />
            </div>

            <div className="mt-4 -mx-1 flex-1 overflow-y-auto px-1">
              <div className="grid gap-2 sm:grid-cols-2">
                {results.map((l) => {
                  const selected = l.code === lang;
                  return (
                    <button
                      key={l.code}
                      type="button"
                      onClick={() => pick(l.code)}
                      className={`flex items-center justify-between gap-2 rounded-xl border-2 px-3 py-2.5 text-left transition ${
                        selected
                          ? "border-slate-950 bg-sky-100 shadow-[2px_2px_0px_#0f172a]"
                          : "border-border bg-background hover:border-slate-400"
                      }`}
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-display text-sm font-bold text-foreground">
                          {l.native}
                        </span>
                        <span className="block truncate text-[11px] font-semibold text-muted-foreground">
                          {l.name}
                          {CURATED_LANGUAGES.includes(l.code) ? " · ✓" : ""}
                        </span>
                      </span>
                      {selected && <Check className="h-4 w-4 shrink-0 text-sky-700" />}
                    </button>
                  );
                })}
              </div>
            </div>

            <p className="mt-3 text-[11px] font-semibold text-muted-foreground">
              {CURATED_LANGUAGES.includes(active.code)
                ? t("reviewedTranslation")
                : active.code === "swa-sign"
                  ? t("kslNote")
                  : t("communityTranslation")}
            </p>

            <Button
              onClick={() => setOpen(false)}
              className="mt-4 w-full rounded-xl border-2 border-slate-950 font-display font-bold shadow-[2px_2px_0px_#0f172a]"
            >
              {t("done")}
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
