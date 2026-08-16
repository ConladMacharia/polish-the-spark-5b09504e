import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Baby, Check, Loader2, Save } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";

const CP_TYPES = [
  "Spastic diplegia",
  "Spastic hemiplegia",
  "Spastic quadriplegia",
  "Dyskinetic",
  "Ataxic",
  "Mixed",
  "Not sure yet",
];

const SIDES = [
  { value: "right", label: "Right" },
  { value: "left", label: "Left" },
  { value: "bilateral", label: "Both" },
] as const;

const MACS = [
  { value: "I", label: "Level I — handles objects easily and successfully" },
  { value: "II", label: "Level II — handles most objects, with somewhat reduced quality or speed" },
  {
    value: "III",
    label: "Level III — handles objects with difficulty, needs help to prepare or modify activities",
  },
  { value: "IV", label: "Level IV — handles a limited selection of easily managed objects" },
  { value: "V", label: "Level V — cannot handle objects or complete simple hand actions" },
];

const MOBILITY = [
  { value: "independent", label: "Walks independently" },
  { value: "support", label: "Walks with support" },
  { value: "wheelchair", label: "Uses a wheelchair" },
];

export type ChildProfile = {
  id?: string;
  child_name?: string | null;
  age_years?: number | null;
  cp_type?: string | null;
  affected_side?: string | null;
  macs_level?: string | null;
  mobility?: string | null;
  condition_notes?: string | null;
};

export function ChildProfileSheet({
  open,
  onOpenChange,
  patient,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  patient: ChildProfile | null | undefined;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState<ChildProfile>({});

  useEffect(() => {
    if (open && patient) setForm(patient);
  }, [open, patient]);

  const save = useMutation({
    mutationFn: async () => {
      if (!patient?.id) throw new Error("No child profile yet");
      const payload = {
        child_name: form.child_name?.trim() || "My child",
        age_years: form.age_years ?? null,
        cp_type: form.cp_type ?? null,
        affected_side: form.affected_side ?? "bilateral",
        macs_level: form.macs_level ?? null,
        mobility: form.mobility ?? null,
        condition_notes: form.condition_notes ?? null,
      };
      const { error } = await supabase
        .from("patients")
        .update(payload as never)
        .eq("id", patient.id);
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("Child profile saved");
      await qc.invalidateQueries({ queryKey: ["my-patient"] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="left"
        className="w-full overflow-y-auto border-r-4 border-slate-950 bg-amber-50 p-0 sm:max-w-lg"
      >
        <div className="border-b-4 border-slate-950 bg-gradient-to-br from-blue-600 to-blue-800 px-6 py-6 text-white">
          <SheetHeader className="space-y-1 text-left">
            <div className="mb-3 grid h-14 w-14 place-items-center rounded-2xl border-2 border-slate-950 bg-yellow-400 text-slate-950 shadow-[3px_3px_0px_rgba(0,0,0,0.35)]">
              <Baby className="h-7 w-7" />
            </div>
            <SheetTitle className="font-display text-3xl text-white">
              {patient?.child_name ? patient.child_name : "Add a child"}
            </SheetTitle>
            <SheetDescription className="text-sm font-medium text-white/85">
              This sets up their profile and unlocks the right games and exercises for them.
            </SheetDescription>
          </SheetHeader>
        </div>

        <form
          className="space-y-6 px-6 py-6"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
            <div className="space-y-1.5">
              <Label className="text-xs font-extrabold uppercase tracking-wide text-slate-600">
                Child's name
              </Label>
              <Input
                value={form.child_name ?? ""}
                placeholder="e.g. Amani"
                onChange={(e) => setForm((f) => ({ ...f, child_name: e.target.value }))}
                className="rounded-xl border-2 border-slate-950 bg-card font-semibold shadow-[2px_2px_0px_#0f172a]"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-extrabold uppercase tracking-wide text-slate-600">
                Age
              </Label>
              <Input
                type="number"
                min={0}
                max={25}
                value={form.age_years ?? ""}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    age_years: e.target.value === "" ? null : Number(e.target.value),
                  }))
                }
                className="rounded-xl border-2 border-slate-950 bg-card font-semibold shadow-[2px_2px_0px_#0f172a]"
              />
            </div>
          </div>
          <p className="-mt-4 text-xs font-semibold text-slate-500">
            If born premature, use adjusted age rather than actual age.
          </p>

          <Field label="CP type">
            <div className="flex flex-wrap gap-2">
              {CP_TYPES.map((t) => (
                <Chip
                  key={t}
                  active={form.cp_type === t}
                  onClick={() => setForm((f) => ({ ...f, cp_type: t }))}
                >
                  {t}
                </Chip>
              ))}
            </div>
          </Field>

          <Field label="Side affected">
            <div className="flex flex-wrap gap-2">
              {SIDES.map((s) => (
                <Chip
                  key={s.value}
                  active={form.affected_side === s.value}
                  onClick={() => setForm((f) => ({ ...f, affected_side: s.value }))}
                >
                  {s.label}
                </Chip>
              ))}
            </div>
          </Field>

          <Field label="MACS level — hand function">
            <div className="space-y-2">
              {MACS.map((m) => {
                const active = form.macs_level === m.value;
                return (
                  <button
                    type="button"
                    key={m.value}
                    onClick={() => setForm((f) => ({ ...f, macs_level: m.value }))}
                    className={`flex w-full items-start gap-3 rounded-2xl border-2 border-slate-950 p-3 text-left transition-transform active:translate-x-0.5 active:translate-y-0.5 ${
                      active
                        ? "bg-lime-300 shadow-[4px_4px_0px_#0f172a]"
                        : "bg-card shadow-[2px_2px_0px_#0f172a]"
                    }`}
                  >
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border-2 border-slate-950 bg-amber-100 font-display text-sm font-extrabold text-slate-900">
                      {m.value}
                    </span>
                    <span className="text-xs font-semibold leading-relaxed text-slate-700">
                      {m.label}
                    </span>
                    {active && <Check className="ml-auto h-4 w-4 shrink-0 text-slate-900" />}
                  </button>
                );
              })}
            </div>
          </Field>

          <Field label="Mobility — walking ability">
            <div className="flex flex-wrap gap-2">
              {MOBILITY.map((m) => (
                <Chip
                  key={m.value}
                  active={form.mobility === m.value}
                  onClick={() => setForm((f) => ({ ...f, mobility: m.value }))}
                >
                  {m.label}
                </Chip>
              ))}
            </div>
            <p className="mt-2 text-xs font-semibold text-slate-500">
              Used to keep standing/balance exercises safe for this child.
            </p>
          </Field>

          <Field label="Notes for this child (optional)">
            <Textarea
              rows={3}
              placeholder="e.g. Right wrist contracture — avoid full extension targets"
              value={form.condition_notes ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, condition_notes: e.target.value }))}
              className="rounded-xl border-2 border-slate-950 bg-card font-medium shadow-[2px_2px_0px_#0f172a]"
            />
          </Field>

          <Button
            type="submit"
            disabled={save.isPending}
            className="w-full rounded-xl border-2 border-slate-950 bg-yellow-400 py-6 font-display text-base font-extrabold text-slate-950 shadow-[4px_4px_0px_#0f172a] hover:bg-yellow-300"
          >
            {save.isPending ? (
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            ) : (
              <Save className="mr-2 h-5 w-5" />
            )}
            Save child profile
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label className="text-xs font-extrabold uppercase tracking-wide text-slate-600">
        {label}
      </Label>
      {children}
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border-2 border-slate-950 px-3.5 py-1.5 text-xs font-extrabold transition-transform active:translate-y-0.5 ${
        active
          ? "bg-pink-500 text-white shadow-[3px_3px_0px_#0f172a]"
          : "bg-card text-slate-800 shadow-[2px_2px_0px_#0f172a]"
      }`}
    >
      {children}
    </button>
  );
}
