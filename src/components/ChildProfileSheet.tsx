import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Baby, Check, Loader2, Save } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { AmbientBlobs, Chip, GlassCard, SectionLabel } from "@/components/ui/glass";
import { KENYA_COUNTIES } from "@/lib/kenya";
import { PHONE_PATTERN, newClaimCode, setActiveChildId } from "@/lib/activeChild";

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
    label:
      "Level III — handles objects with difficulty, needs help to prepare or modify activities",
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
  county?: string | null;
  sub_county?: string | null;
  ward?: string | null;
  consent_at?: string | null;
};

export function ChildProfileSheet({
  open,
  onOpenChange,
  patient,
  isNew = false,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  patient: ChildProfile | null | undefined;
  /** true = a blank form that adds ANOTHER child instead of editing this one */
  isNew?: boolean;
  onCreated?: (childId: string) => void;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState<ChildProfile>({});
  const [consent, setConsent] = useState(false);
  const [phone, setPhone] = useState("");

  // The caregiver's own phone number (shared by all their children).
  const { data: contact } = useQuery({
    queryKey: ["me-contact"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("phone, preferred_language")
        .eq("id", u.user.id)
        .maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    if (!open) return;
    if (isNew) {
      // A fresh, empty form every time.
      setForm({});
      setConsent(false);
    } else if (patient) {
      setForm(patient);
      setConsent(!!patient.consent_at);
    }
    setPhone(contact?.phone ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isNew, patient, contact?.phone]);

  const save = useMutation({
    mutationFn: async () => {
      const cleanPhone = phone.trim();
      if (cleanPhone && !PHONE_PATTERN.test(cleanPhone)) {
        throw new Error("Please enter a valid phone number, for example 0712 345 678");
      }
      if (isNew && !form.child_name?.trim()) throw new Error("Please enter the child's name");
      if (!isNew && !patient?.id) throw new Error("No child profile yet");

      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Please sign in again");

      const fields = {
        child_name: form.child_name?.trim() || "My child",
        age_years: form.age_years ?? null,
        cp_type: form.cp_type ?? null,
        affected_side: form.affected_side ?? "bilateral",
        macs_level: form.macs_level ?? null,
        mobility: form.mobility ?? null,
        condition_notes: form.condition_notes ?? null,
        county: form.county || null,
        sub_county: form.sub_county?.trim() || null,
        ward: form.ward?.trim() || null,
      };

      // Phone number lives on the caregiver, so every child shares it.
      const { error: pErr } = await supabase
        .from("profiles")
        .update({ phone: cleanPhone || null })
        .eq("id", u.user.id);
      if (pErr) throw pErr;

      if (isNew) {
        const { data: created, error } = await supabase
          .from("patients")
          .insert({
            ...fields,
            claimed_by_caregiver_id: u.user.id,
            claimed_at: new Date().toISOString(),
            claim_code: newClaimCode(),
            preferred_language: (contact?.preferred_language as "en" | "sw" | "ki") ?? "en",
            goals: [],
            ...(consent ? { consent_at: new Date().toISOString() } : {}),
          } as never)
          .select("id")
          .single();
        if (error) throw error;
        return { id: (created as { id: string }).id, name: fields.child_name };
      }

      const { error } = await supabase
        .from("patients")
        .update({
          ...fields,
          // Consent is recorded once, with the date. Ticking it again later
          // does not move the original date.
          ...(consent && !patient?.consent_at ? { consent_at: new Date().toISOString() } : {}),
        } as never)
        .eq("id", patient!.id as string);
      if (error) throw error;
      return { id: patient!.id as string, name: fields.child_name };
    },
    onSuccess: async (result) => {
      toast.success(isNew ? `${result.name} added` : "Child profile saved");
      if (isNew) setActiveChildId(result.id);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["my-patient"] }),
        qc.invalidateQueries({ queryKey: ["my-children"] }),
        qc.invalidateQueries({ queryKey: ["me-contact"] }),
        qc.invalidateQueries({ queryKey: ["me-profile"] }),
      ]);
      onOpenChange(false);
      if (isNew) onCreated?.(result.id);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="left"
        className="w-full overflow-y-auto border-r border-white/10 bg-emerald-950 p-0 sm:max-w-lg"
      >
        <div className="relative overflow-hidden border-b border-white/10 bg-gradient-to-br from-emerald-900 to-emerald-950 px-6 py-6 text-stone-50">
          <AmbientBlobs />
          <SheetHeader className="relative space-y-1 text-left">
            <div className="mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-emerald-300 to-emerald-500 text-emerald-950 shadow-lg shadow-emerald-500/30">
              <Baby className="h-7 w-7" />
            </div>
            <SheetTitle className="font-display text-3xl text-stone-50">
              {isNew
                ? "Add another child"
                : patient?.child_name
                  ? patient.child_name
                  : "Add a child"}
            </SheetTitle>
            <SheetDescription className="text-sm font-medium text-stone-300">
              {isNew
                ? "Fill in this child's details, save, then ask for a specialist if you need one."
                : "This sets up their profile and unlocks the right games and exercises for them."}
            </SheetDescription>
          </SheetHeader>
        </div>

        <form
          className="space-y-6 bg-emerald-950 px-6 py-6 text-stone-50"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-wide text-emerald-300">
                Child's name
              </Label>
              <Input
                value={form.child_name ?? ""}
                placeholder="e.g. Amani"
                onChange={(e) => setForm((f) => ({ ...f, child_name: e.target.value }))}
                className="rounded-2xl border-white/15 bg-white/[0.08] font-semibold text-stone-50 placeholder:text-stone-500 backdrop-blur-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-wide text-emerald-300">
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
                className="rounded-2xl border-white/15 bg-white/[0.08] font-semibold text-stone-50 backdrop-blur-xl"
              />
            </div>
          </div>
          <p className="-mt-4 text-[11px] text-stone-400">
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
                    className={`flex w-full items-start gap-3 rounded-2xl border p-3 text-left backdrop-blur-xl transition-colors ${
                      active
                        ? "border-emerald-200/30 bg-gradient-to-br from-emerald-300/20 to-emerald-500/5"
                        : "border-white/10 bg-white/[0.05]"
                    }`}
                  >
                    <span
                      className={`grid h-8 w-8 shrink-0 place-items-center rounded-full font-display text-xs font-bold ${
                        active ? "bg-emerald-300 text-emerald-950" : "bg-white/10 text-stone-300"
                      }`}
                    >
                      {m.value}
                    </span>
                    <span className="text-[12.5px] font-medium leading-relaxed text-stone-300">
                      {m.label}
                    </span>
                    {active && <Check className="ml-auto h-4 w-4 shrink-0 text-emerald-300" />}
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
            <p className="mt-2 text-[11px] text-stone-400">
              Used to keep standing/balance exercises safe for this child.
            </p>
          </Field>

          <Field label="Your phone number">
            <Input
              type="tel"
              inputMode="tel"
              value={phone}
              placeholder="e.g. 0712 345 678"
              onChange={(e) => setPhone(e.target.value)}
              className="rounded-2xl border-white/15 bg-white/[0.08] font-semibold text-stone-50 placeholder:text-stone-500 backdrop-blur-xl"
            />
            <p className="mt-2 text-[11px] text-stone-400">
              The coordinator and your matched therapist call this number to arrange visits.
            </p>
          </Field>

          <Field label="Where you live">
            <div className="space-y-3">
              <select
                value={form.county ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, county: e.target.value }))}
                className="w-full rounded-2xl border border-white/15 bg-white/[0.08] px-3 py-2.5 text-sm font-semibold text-stone-50 backdrop-blur-xl"
              >
                <option value="" className="text-stone-900">
                  Choose your county
                </option>
                {KENYA_COUNTIES.map((c) => (
                  <option key={c} value={c} className="text-stone-900">
                    {c}
                  </option>
                ))}
              </select>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  value={form.sub_county ?? ""}
                  placeholder="Sub-county"
                  onChange={(e) => setForm((f) => ({ ...f, sub_county: e.target.value }))}
                  className="rounded-2xl border-white/15 bg-white/[0.08] font-semibold text-stone-50 placeholder:text-stone-500 backdrop-blur-xl"
                />
                <Input
                  value={form.ward ?? ""}
                  placeholder="Ward"
                  onChange={(e) => setForm((f) => ({ ...f, ward: e.target.value }))}
                  className="rounded-2xl border-white/15 bg-white/[0.08] font-semibold text-stone-50 placeholder:text-stone-500 backdrop-blur-xl"
                />
              </div>
            </div>
            <p className="mt-2 text-[11px] text-stone-400">
              Used only to find a specialist who can reach you.
            </p>
          </Field>

          <Field label="Sharing with a specialist">
            <label className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.05] p-3 backdrop-blur-xl">
              <input
                type="checkbox"
                checked={consent}
                disabled={!isNew && !!patient?.consent_at}
                onChange={(e) => setConsent(e.target.checked)}
                className="mt-0.5 h-5 w-5 shrink-0 accent-emerald-300"
              />
              <span className="text-[12.5px] font-medium leading-relaxed text-stone-300">
                I am this child's parent or guardian. I agree that this child's profile and progress
                can be shared with a verified therapist who is matched to us, so they can plan care.
              </span>
            </label>
            {!isNew && patient?.consent_at && (
              <p className="mt-2 text-[11px] text-emerald-300">
                Consent recorded on {new Date(patient.consent_at).toLocaleDateString()}.
              </p>
            )}
          </Field>

          <Field label="Notes for this child (optional)">
            <GlassCard tint="neutral" className="p-1">
              <Textarea
                rows={3}
                placeholder="e.g. Right wrist contracture — avoid full extension targets"
                value={form.condition_notes ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, condition_notes: e.target.value }))}
                className="resize-none border-0 bg-transparent font-medium text-stone-100 placeholder:text-stone-500 focus-visible:ring-0"
              />
            </GlassCard>
          </Field>

          <button
            type="submit"
            disabled={save.isPending}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-emerald-300 py-3.5 font-display text-base font-bold text-emerald-950 transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {save.isPending ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Save className="h-5 w-5" />
            )}
            {isNew ? "Save child" : "Save child profile"}
          </button>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <SectionLabel>{label}</SectionLabel>
      {children}
    </div>
  );
}

export default ChildProfileSheet;
