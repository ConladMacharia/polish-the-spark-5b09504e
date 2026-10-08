import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { useActiveChild } from "@/lib/activeChild";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

/** Row of child chips (tap to switch) plus an "Add child" button. */
export function ChildSwitcher() {
  const { t } = useLanguage();
  const { children, patient, select, add } = useActiveChild();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      await add(name);
      toast.success("Child added. Open Profile to fill in their details.");
      setName("");
      setOpen(false);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {children.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => select(c.id)}
            className={`rounded-full border px-4 py-1.5 font-display text-[13px] font-semibold transition-colors ${
              patient?.id === c.id
                ? "border-emerald-300 bg-emerald-300 text-emerald-950"
                : "border-white/15 bg-white/10 text-stone-200"
            }`}
          >
            {c.child_name}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center gap-1 rounded-full border border-dashed border-white/30 px-3.5 py-1.5 font-display text-[13px] font-semibold text-emerald-200"
        >
          <Plus className="h-3.5 w-3.5" /> {t("uiAddChild")}
        </button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm border-white/15 bg-emerald-950 text-stone-50">
          <DialogTitle className="font-display text-xl font-bold">{t("uiAddChild")}</DialogTitle>
          <DialogDescription className="sr-only">Add another child profile</DialogDescription>
          <form onSubmit={submit} className="space-y-3">
            <label className="block text-sm font-semibold" htmlFor="new-child-name">
              {t("uiChildName")}
            </label>
            <input
              id="new-child-name"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
              className="w-full rounded-xl border border-white/20 bg-white/10 px-3 py-2.5 text-stone-50 outline-none focus:border-emerald-300"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex-1 rounded-full border border-white/20 px-4 py-2.5 text-sm font-bold"
              >
                {t("uiCancel")}
              </button>
              <button
                type="submit"
                disabled={saving || !name.trim()}
                className="flex-1 rounded-full bg-emerald-300 px-4 py-2.5 text-sm font-bold text-emerald-950 disabled:opacity-60"
              >
                {t("uiAddChild")}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
