import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import {
  Copy,
  LogOut,
  Plus,
  Stethoscope,
  User,
  Calendar,
  Sparkles,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/app/therapist")({
  head: () => ({
    meta: [{ title: "Therapist dashboard — Neuro-Bridge" }],
  }),
  component: TherapistDashboard,
});

const GMFCS = ["I", "II", "III", "IV", "V"] as const;
const SIDES = ["left", "right", "bilateral", "none"] as const;
const LANGS = [
  { value: "en", label: "English" },
  { value: "sw", label: "Kiswahili" },
  { value: "ki", label: "Gikuyu" },
] as const;

const patientSchema = z.object({
  child_name: z.string().trim().min(1).max(80),
  gmfcs_level: z.enum(GMFCS).optional(),
  affected_side: z.enum(SIDES),
  preferred_language: z.enum(["en", "sw", "ki"]),
  date_of_birth: z.string().optional(),
  condition_notes: z.string().max(1000).optional(),
});

function TherapistDashboard() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: patients, isLoading } = useQuery({
    queryKey: ["patients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("patients")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  async function handleSignOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-background">
      <TopBar
        eyebrow="Therapist"
        icon={<Stethoscope className="h-4 w-4" />}
        title="Your patients"
        onSignOut={handleSignOut}
      />

      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="font-display text-3xl">Patients</h1>
            <p className="text-sm text-muted-foreground">
              Create a patient, share the claim code with the caregiver.
            </p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="lg" className="rounded-full">
                <Plus className="mr-2 h-4 w-4" /> New patient
              </Button>
            </DialogTrigger>
            <NewPatientDialog onDone={() => setOpen(false)} />
          </Dialog>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : !patients || patients.length === 0 ? (
          <EmptyState onCreate={() => setOpen(true)} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {patients.map((p) => (
              <PatientCard key={p.id} patient={p} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="rounded-3xl border border-dashed border-border bg-card p-10 text-center">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-accent text-accent-foreground">
        <Sparkles className="h-6 w-6" />
      </div>
      <h3 className="mt-4 font-display text-xl">No patients yet</h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
        Add your first patient. You'll get an 8-character code to hand to the
        caregiver — they enter it once to link their account.
      </p>
      <Button className="mt-6 rounded-full" onClick={onCreate}>
        <Plus className="mr-2 h-4 w-4" /> New patient
      </Button>
    </div>
  );
}

function PatientCard({ patient }: { patient: any }) {
  return (
    <Link
      to="/app/therapist/patient/$patientId"
      params={{ patientId: patient.id }}
      className="block rounded-3xl border border-border bg-card p-5 shadow-sm transition-transform hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Patient
          </p>
          <p className="font-display text-xl">{patient.child_name}</p>
        </div>
        <span className="rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground">
          {patient.gmfcs_level ? `GMFCS ${patient.gmfcs_level}` : "—"}
        </span>
      </div>
      <div className="mt-4 space-y-1 text-xs text-muted-foreground">
        <p>
          Affected side: <span className="capitalize">{patient.affected_side}</span>
        </p>
        <p>Language: {LANGS.find((l) => l.value === patient.preferred_language)?.label}</p>
      </div>

      <div className="mt-4 rounded-2xl bg-secondary p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {patient.claimed_by_caregiver_id ? "Linked to caregiver" : "Claim code"}
        </p>
        {patient.claimed_by_caregiver_id ? (
          <p className="mt-1 text-sm font-semibold text-sage">Active</p>
        ) : (
          <div className="mt-1 flex items-center justify-between">
            <code className="font-mono text-lg tracking-widest">{patient.claim_code}</code>
            <Button
              size="sm"
              variant="ghost"
              onClick={(e) => {
                e.preventDefault();
                navigator.clipboard.writeText(patient.claim_code);
                toast.success("Code copied");
              }}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </Link>
  );
}

function NewPatientDialog({ onDone }: { onDone: () => void }) {
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    child_name: "",
    gmfcs_level: "" as (typeof GMFCS)[number] | "",
    affected_side: "none" as (typeof SIDES)[number],
    preferred_language: "en" as "en" | "sw" | "ki",
    date_of_birth: "",
    condition_notes: "",
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const parsed = patientSchema.safeParse({
        ...form,
        gmfcs_level: form.gmfcs_level || undefined,
        date_of_birth: form.date_of_birth || undefined,
        condition_notes: form.condition_notes || undefined,
      });
      if (!parsed.success) {
        toast.error(parsed.error.issues[0].message);
        return;
      }
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      // Generate a claim code via RPC
      const { data: codeData, error: codeErr } = await supabase.rpc("generate_claim_code");
      if (codeErr || !codeData) {
        toast.error("Could not generate claim code");
        return;
      }

      const { error } = await supabase.from("patients").insert({
        therapist_id: userData.user.id,
        claim_code: codeData as string,
        child_name: parsed.data.child_name,
        gmfcs_level: parsed.data.gmfcs_level ?? null,
        affected_side: parsed.data.affected_side,
        preferred_language: parsed.data.preferred_language,
        date_of_birth: parsed.data.date_of_birth ?? null,
        condition_notes: parsed.data.condition_notes ?? null,
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Patient created");
      qc.invalidateQueries({ queryKey: ["patients"] });
      onDone();
    } finally {
      setSaving(false);
    }
  }

  return (
    <DialogContent className="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>Add a new patient</DialogTitle>
        <DialogDescription>
          A claim code is generated automatically. Share it with the caregiver.
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="child_name">Child's name</Label>
          <Input
            id="child_name"
            value={form.child_name}
            onChange={(e) => setForm({ ...form, child_name: e.target.value })}
            required
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>GMFCS level</Label>
            <Select
              value={form.gmfcs_level}
              onValueChange={(v) =>
                setForm({ ...form, gmfcs_level: v as (typeof GMFCS)[number] })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                {GMFCS.map((g) => (
                  <SelectItem key={g} value={g}>
                    Level {g}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Affected side</Label>
            <Select
              value={form.affected_side}
              onValueChange={(v) =>
                setForm({ ...form, affected_side: v as (typeof SIDES)[number] })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SIDES.map((s) => (
                  <SelectItem key={s} value={s} className="capitalize">
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Family language</Label>
            <Select
              value={form.preferred_language}
              onValueChange={(v) =>
                setForm({ ...form, preferred_language: v as "en" | "sw" | "ki" })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LANGS.map((l) => (
                  <SelectItem key={l.value} value={l.value}>
                    {l.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dob">Date of birth</Label>
            <Input
              id="dob"
              type="date"
              value={form.date_of_birth}
              onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })}
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="notes">Condition notes</Label>
          <Textarea
            id="notes"
            rows={3}
            value={form.condition_notes}
            onChange={(e) => setForm({ ...form, condition_notes: e.target.value })}
            placeholder="Diagnosis, goals, contraindications…"
          />
        </div>
        <DialogFooter>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Create patient"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

function TopBar({
  eyebrow,
  icon,
  title,
  onSignOut,
}: {
  eyebrow: string;
  icon: React.ReactNode;
  title: string;
  onSignOut: () => void;
}) {
  return (
    <header className="border-b border-border bg-card/60 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground font-display text-lg">
            N
          </span>
          <div>
            <p className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
              {icon} {eyebrow}
            </p>
            <p className="font-display text-lg leading-none">{title}</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={onSignOut}>
          <LogOut className="mr-2 h-4 w-4" /> Sign out
        </Button>
      </div>
    </header>
  );
}
