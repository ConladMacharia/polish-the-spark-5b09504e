import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { BadgeCheck, Clock, Crosshair, FileCheck2, Loader2, UploadCloud } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMyTherapist } from "@/lib/therapist";
import {
  COUNTY_CENTROIDS,
  KENYA_COUNTIES,
  PROFESSIONS,
  SPECIALIST_NEEDS,
  THERAPIST_LANGUAGES,
  WEEKDAYS,
} from "@/lib/kenya";

export const Route = createFileRoute("/_authenticated/app/therapist/profile")({
  head: () => ({ meta: [{ title: "My profile — Neuro-Bridge" }] }),
  component: Profile,
});

const MAX_BYTES = 5 * 1024 * 1024;
const OK_TYPES = ["application/pdf", "image/jpeg", "image/png"];

function Profile() {
  const qc = useQueryClient();
  const { data: me, isLoading } = useMyTherapist();
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: person } = useQuery({
    queryKey: ["therapist-person"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, phone")
        .eq("id", u.user.id)
        .maybeSingle();
      return data;
    },
  });

  const [f, setF] = useState({
    full_name: "",
    phone: "",
    profession: "",
    license_number: "",
    license_body: "",
    clinic_name: "",
    county: "",
    city: "",
    radius_km: "30",
    home_visits: true,
    specializations: [] as string[],
    available_days: [] as string[],
    languages: [] as string[],
  });
  const [exact, setExact] = useState<{ lat: number; lng: number } | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [agree, setAgree] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Fill the form once, from what is already saved.
  useEffect(() => {
    if (loaded || isLoading || person === undefined) return;
    setF({
      full_name: person?.full_name ?? "",
      phone: person?.phone ?? "",
      profession: me?.profession ?? "",
      license_number: me?.license_number ?? "",
      license_body: me?.license_body ?? "",
      clinic_name: me?.clinic_name ?? "",
      county: me?.county ?? "",
      city: me?.city ?? "",
      radius_km: String(me?.radius_km ?? 30),
      home_visits: me?.home_visits ?? true,
      specializations: me?.specializations ?? [],
      available_days: me?.available_days ?? [],
      languages: me?.languages ?? [],
    });
    if (me?.home_lat != null && me?.home_lng != null && !me?.county) {
      setExact({ lat: me.home_lat, lng: me.home_lng });
    }
    setLoaded(true);
  }, [loaded, isLoading, me, person]);

  const firstTime = !me?.profile_submitted_at;
  const hasDoc = !!me?.license_document_path;

  const toggle = (key: "specializations" | "available_days" | "languages", v: string) =>
    setF((cur) => ({
      ...cur,
      [key]: cur[key].includes(v) ? cur[key].filter((x) => x !== v) : [...cur[key], v],
    }));

  function pickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0];
    if (!picked) return;
    if (!OK_TYPES.includes(picked.type)) {
      toast.error("Please choose a PDF, JPG or PNG file");
      e.target.value = "";
      return;
    }
    if (picked.size > MAX_BYTES) {
      toast.error("That file is too big. The limit is 5 MB.");
      e.target.value = "";
      return;
    }
    setFile(picked);
  }

  function useMyLocation() {
    if (!navigator.geolocation) return toast.error("Your device cannot share its location");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setExact({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        toast.success("Location saved for this profile");
      },
      () => toast.error("Could not get your location. You can still choose your county."),
      { enableHighAccuracy: false, timeout: 10_000 },
    );
  }

  const save = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Please sign in again");
      const uid = u.user.id;

      const radius = Number(f.radius_km);
      if (!f.full_name.trim()) throw new Error("Please enter your name");
      if (!f.profession) throw new Error("Choose your profession");
      if (f.license_number.trim().length < 3)
        throw new Error("Enter your licence or registration number");
      if (!f.license_body.trim()) throw new Error("Enter who issued your licence");
      if (!f.county) throw new Error("Choose the county you work from");
      if (!Number.isFinite(radius) || radius < 1 || radius > 500)
        throw new Error("Travel distance must be between 1 and 500 km");
      if (f.specializations.length === 0)
        throw new Error("Choose at least one kind of therapy you offer");
      if (f.languages.length === 0) throw new Error("Choose at least one language you speak");
      if (!file && !hasDoc) throw new Error("Upload a copy of your licence");
      if (firstTime && !agree) throw new Error("Please tick the confirmation at the bottom");

      let docPath = me?.license_document_path ?? null;
      if (file) {
        const ext = (file.name.split(".").pop() || "pdf").toLowerCase().replace(/[^a-z0-9]/g, "");
        const path = `${uid}/licence-${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("therapist-docs")
          .upload(path, file, { contentType: file.type, upsert: false });
        if (upErr) throw new Error(`Could not upload the document: ${upErr.message}`);
        if (docPath) await supabase.storage.from("therapist-docs").remove([docPath]);
        docPath = path;
      }

      const centre = COUNTY_CENTROIDS[f.county];
      const lat = exact?.lat ?? centre?.lat ?? null;
      const lng = exact?.lng ?? centre?.lng ?? null;

      const { error } = await supabase.from("therapists").upsert(
        {
          user_id: uid,
          clinic_name: f.clinic_name.trim(),
          license_number: f.license_number.trim(),
          license_body: f.license_body.trim(),
          license_document_path: docPath,
          country: "Kenya",
          county: f.county,
          city: f.city.trim() || f.county,
          profession: f.profession,
          specializations: f.specializations,
          home_lat: lat,
          home_lng: lng,
          radius_km: Math.round(radius),
          home_visits: f.home_visits,
          available_days: f.available_days,
          languages: f.languages,
          profile_submitted_at: me?.profile_submitted_at ?? new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );
      if (error) throw error;

      const { error: pErr } = await supabase
        .from("profiles")
        .update({ full_name: f.full_name.trim(), phone: f.phone.trim() || null })
        .eq("id", uid);
      if (pErr) throw pErr;
    },
    onSuccess: async () => {
      toast.success(firstTime ? "Sent for verification" : "Profile saved");
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
      await qc.invalidateQueries({ queryKey: ["therapist-me"] });
      await qc.invalidateQueries({ queryKey: ["therapist-person"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading || !loaded) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-6 text-sm text-muted-foreground sm:px-6">
        Loading…
      </main>
    );
  }

  const status = me?.verified
    ? { icon: BadgeCheck, title: "Verified", line: "You can receive requests and log visits." }
    : me?.profile_submitted_at
      ? {
          icon: Clock,
          title: "Waiting for verification",
          line: "A coordinator is checking your licence.",
        }
      : {
          icon: FileCheck2,
          title: "Complete your profile",
          line: "Add your licence and service area so we can verify you.",
        };
  const StatusIcon = status.icon;

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <section className="nb-hero p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-white/75">Therapist</p>
        <h1 className="font-display text-3xl">My profile</h1>
        <p className="relative z-10 mt-3 flex items-center gap-2 text-sm text-white/95">
          <StatusIcon className="h-4 w-4" /> <span className="font-semibold">{status.title}.</span>{" "}
          {status.line}
        </p>
      </section>

      <form
        className="mt-6 space-y-6"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <Card title="About you">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name">
              <Input
                value={f.full_name}
                onChange={(e) => setF({ ...f, full_name: e.target.value })}
              />
            </Field>
            <Field label="Phone number">
              <Input
                inputMode="tel"
                value={f.phone}
                onChange={(e) => setF({ ...f, phone: e.target.value })}
                placeholder="07…"
              />
            </Field>
            <Field label="Profession">
              <select
                value={f.profession}
                onChange={(e) => setF({ ...f, profession: e.target.value })}
                className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
              >
                <option value="">Choose…</option>
                {PROFESSIONS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Clinic or organisation (optional)">
              <Input
                value={f.clinic_name}
                onChange={(e) => setF({ ...f, clinic_name: e.target.value })}
              />
            </Field>
          </div>
        </Card>

        <Card
          title="Your licence"
          hint="A coordinator checks this with the professional body before you can receive requests."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Licence or registration number">
              <Input
                value={f.license_number}
                onChange={(e) => setF({ ...f, license_number: e.target.value })}
              />
            </Field>
            <Field label="Who issued it?">
              <Input
                value={f.license_body}
                onChange={(e) => setF({ ...f, license_body: e.target.value })}
                placeholder="The council or association that registered you"
              />
            </Field>
          </div>
          <div className="mt-4">
            <Label>Copy of your licence (PDF, JPG or PNG, up to 5 MB)</Label>
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf,image/jpeg,image/png"
              onChange={pickFile}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="mt-1.5 flex w-full items-center gap-3 rounded-2xl border border-dashed border-border bg-secondary/60 p-4 text-left text-sm transition hover:bg-secondary"
            >
              <UploadCloud className="h-5 w-5 shrink-0 text-primary" />
              <span>
                {file ? (
                  <>
                    <span className="font-semibold">{file.name}</span> ready to upload
                  </>
                ) : hasDoc ? (
                  <>
                    <span className="font-semibold">Document uploaded.</span> Tap to replace it.
                  </>
                ) : (
                  <span className="font-semibold">Tap to choose a file</span>
                )}
              </span>
            </button>
            {me?.verified && (
              <p className="mt-2 text-xs text-muted-foreground">
                If you change your licence number or document, you go back to “waiting for
                verification” until it is checked again.
              </p>
            )}
          </div>
        </Card>

        <Card
          title="Where you work"
          hint="We only send you children who live within the distance you choose."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="County you work from">
              <select
                value={f.county}
                onChange={(e) => {
                  setF({ ...f, county: e.target.value });
                  setExact(null);
                }}
                className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
              >
                <option value="">Choose…</option>
                {KENYA_COUNTIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Town or area (optional)">
              <Input value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} />
            </Field>
            <Field label={`How far will you travel? ${f.radius_km || "…"} km`}>
              <input
                type="range"
                min={5}
                max={300}
                step={5}
                value={Number(f.radius_km) || 30}
                onChange={(e) => setF({ ...f, radius_km: e.target.value })}
                className="w-full accent-[var(--primary)]"
              />
            </Field>
            <div className="flex items-end">
              <Button
                type="button"
                variant="outline"
                className="rounded-full"
                onClick={useMyLocation}
              >
                <Crosshair className="mr-2 h-4 w-4" />
                {exact ? "Location saved" : "Use my exact location (optional)"}
              </Button>
            </div>
          </div>
          <label className="mt-4 flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={f.home_visits}
              onChange={(e) => setF({ ...f, home_visits: e.target.checked })}
              className="h-5 w-5 accent-[var(--primary)]"
            />
            I can visit children at home
          </label>
        </Card>

        <Card title="What you offer">
          <Label>Kinds of therapy</Label>
          <Chips
            items={SPECIALIST_NEEDS}
            chosen={f.specializations}
            onToggle={(v) => toggle("specializations", v)}
          />
          <Label className="mt-5 block">Days you are available</Label>
          <Chips
            items={WEEKDAYS}
            chosen={f.available_days}
            onToggle={(v) => toggle("available_days", v)}
          />
          <Label className="mt-5 block">Languages you speak</Label>
          <Chips
            items={THERAPIST_LANGUAGES}
            chosen={f.languages}
            onToggle={(v) => toggle("languages", v)}
          />
        </Card>

        {firstTime && (
          <label className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4 text-sm">
            <input
              type="checkbox"
              checked={agree}
              onChange={(e) => setAgree(e.target.checked)}
              className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--primary)]"
            />
            <span>
              I confirm these details are true and that I am registered to practise. I understand a
              coordinator will check my licence.
            </span>
          </label>
        )}

        <Button type="submit" size="lg" className="w-full rounded-full" disabled={save.isPending}>
          {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {firstTime ? "Send for verification" : "Save changes"}
        </Button>
      </form>
    </main>
  );
}

function Card({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-border bg-card p-5 shadow-sm">
      <h2 className="font-display text-lg">{title}</h2>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function Chips({
  items,
  chosen,
  onToggle,
}: {
  items: readonly { value: string; label: string }[];
  chosen: string[];
  onToggle: (v: string) => void;
}) {
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {items.map((i) => {
        const on = chosen.includes(i.value);
        return (
          <button
            key={i.value}
            type="button"
            onClick={() => onToggle(i.value)}
            aria-pressed={on}
            className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
              on
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:bg-secondary"
            }`}
          >
            {i.label}
          </button>
        );
      })}
    </div>
  );
}
