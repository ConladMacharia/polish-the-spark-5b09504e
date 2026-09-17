import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Chip, SectionLabel } from "@/components/ui/glass";

type AffectedSide = "left" | "right" | "bilateral";

export type ChildProfilePatient = {
  id: string;
  child_name: string;
  age_years: number | null;
  affected_side: AffectedSide;
  gmfcs_level: string | null;
  macs_level: string | null;
  mobility: string | null;
  goals: string[] | null;
} | null;

const SIDES: AffectedSide[] = ["left", "right", "bilateral"];
const GMFCS = ["I", "II", "III", "IV", "V"];
const MACS = ["I", "II", "III", "IV", "V"];

/** Slide-over panel where a caregiver reviews and updates the child's
 *  therapy profile (name, age, affected side, GMFCS/MACS levels). */
export function ChildProfileSheet({
  open,
  onOpenChange,
  patient,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patient: ChildProfilePatient;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [side, setSide] = useState<AffectedSide>("bilateral");
  const [gmfcs, setGmfcs] = useState<string | null>(null);
  const [macs, setMacs] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !patient) return;
    setName(patient.child_name ?? "");
    setAge(patient.age_years != null ? String(patient.age_years) : "");
    setSide((patient.affected_side as AffectedSide) ?? "bilateral");
    setGmfcs(patient.gmfcs_level ?? null);
    setMacs(patient.macs_level ?? null);
    setError(null);
  }, [open, patient]);

  if (!open) return null;

  async function save() {
    if (!patient) return;
    setSaving(true);
    setError(null);
    const parsedAge = age.trim() === "" ? null : Number(age);
    const { error: err } = await supabase
      .from("patients")
      .update({
        child_name: name.trim() || "My child",
        age_years: Number.isFinite(parsedAge as number) ? (parsedAge as number) : null,
        affected_side: side,
        gmfcs_level: (gmfcs as never) ?? null,
        macs_level: macs,
      })
      .eq("id", patient.id);
    setSaving(false);
    if (err) {
      setError("Could not save just now. Please try again.");
      return;
    }
    await qc.invalidateQueries({ queryKey: ["my-patient"] });
    onOpenChange(false);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4"
      onClick={() => onOpenChange(false)}
    >
      <div
        className="max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-white/15 bg-emerald-950/95 p-5 text-stone-50 backdrop-blur-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-display text-xl font-bold">Child profile</h3>
          <button
            type="button"
            aria-label="Close"
            onClick={() => onOpenChange(false)}
            className="grid h-9 w-9 place-items-center rounded-full border border-white/15 bg-white/10"
          >
            <X className="h-4 w-4 text-emerald-200" />
          </button>
        </div>

        {!patient ? (
          <p className="mt-6 text-[13px] font-medium text-stone-300">
            No child record yet. Start a session and we&apos;ll create one for you.
          </p>
        ) : (
          <div className="mt-5 space-y-5">
            <div>
              <SectionLabel>Child&apos;s name</SectionLabel>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1.5 w-full rounded-2xl border border-white/15 bg-white/10 px-4 py-2.5 text-[14px] font-medium text-stone-50 outline-none placeholder:text-stone-400"
                placeholder="Amani"
              />
            </div>

            <div>
              <SectionLabel>Age (years)</SectionLabel>
              <input
                value={age}
                inputMode="numeric"
                onChange={(e) => setAge(e.target.value.replace(/[^0-9]/g, ""))}
                className="mt-1.5 w-28 rounded-2xl border border-white/15 bg-white/10 px-4 py-2.5 text-[14px] font-medium text-stone-50 outline-none placeholder:text-stone-400"
                placeholder="6"
              />
            </div>

            <div>
              <SectionLabel>Side affected</SectionLabel>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {SIDES.map((s) => (
                  <Chip key={s} active={side === s} onClick={() => setSide(s)}>
                    {s === "bilateral" ? "Both sides" : s === "left" ? "Left" : "Right"}
                  </Chip>
                ))}
              </div>
            </div>

            <div>
              <SectionLabel>Walking level (GMFCS)</SectionLabel>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {GMFCS.map((lvl) => (
                  <Chip
                    key={lvl}
                    active={gmfcs === lvl}
                    onClick={() => setGmfcs(gmfcs === lvl ? null : lvl)}
                  >
                    {lvl}
                  </Chip>
                ))}
              </div>
            </div>

            <div>
              <SectionLabel>Hand use level (MACS)</SectionLabel>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {MACS.map((lvl) => (
                  <Chip
                    key={lvl}
                    active={macs === lvl}
                    onClick={() => setMacs(macs === lvl ? null : lvl)}
                  >
                    {lvl}
                  </Chip>
                ))}
              </div>
            </div>

            {error ? <p className="text-[12px] font-semibold text-rose-300">{error}</p> : null}

            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="w-full rounded-full bg-emerald-300 px-5 py-3 font-display text-sm font-bold text-emerald-950 disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save profile"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default ChildProfileSheet;
