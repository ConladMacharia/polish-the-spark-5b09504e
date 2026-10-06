import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { BadgeCheck, GitMerge, LogOut, ShieldCheck, Users, Video } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAdminTheme } from "@/lib/adminTheme";
import "@/components/admin/admin-theme.css";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  COUNTY_CENTROIDS,
  THERAPIST_LANGUAGES,
  WEEKDAYS,
  distanceKm,
  needLabel,
  professionLabel,
} from "@/lib/kenya";

export const Route = createFileRoute("/_authenticated/app/admin")({
  head: () => ({ meta: [{ title: "Admin — Neuro-Bridge" }] }),
  component: AdminShell,
});

type View = "verification" | "children" | "matching";

const NAV: { id: View; label: string; icon: typeof ShieldCheck }[] = [
  { id: "verification", label: "Verification", icon: ShieldCheck },
  { id: "children", label: "Children", icon: Users },
  { id: "matching", label: "Matching", icon: GitMerge },
];

// Wide, data-first layout in champagne and emerald ink (see admin-theme.css).
function AdminShell() {
  const [view, setView] = useState<View>("verification");
  useAdminTheme();
  const navigate = useNavigate();
  const qc = useQueryClient();

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="flex min-h-screen text-foreground">
      <aside className="flex w-60 shrink-0 flex-col bg-gradient-to-b from-[#064E3B] to-[#043326] p-4 text-[#F8E7C9]">
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#F8E7C9]/70">
            Neuro-Bridge
          </p>
          <h1 className="text-lg font-semibold">Coordinator</h1>
        </div>
        <nav className="flex flex-1 flex-col gap-1">
          {NAV.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setView(id)}
              className={`flex items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium transition ${
                view === id ? "bg-[#F8E7C9] text-[#064E3B]" : "text-[#F8E7C9]/85 hover:bg-card/10"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
          <button
            onClick={() => navigate({ to: "/app/training" })}
            className="flex items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium text-[#F8E7C9]/85 transition hover:bg-card/10"
          >
            <Video className="h-4 w-4" />
            Training videos
          </button>
        </nav>
        <Button
          variant="ghost"
          className="justify-start text-[#F8E7C9]/80 hover:bg-card/10 hover:text-[#F8E7C9]"
          onClick={signOut}
        >
          <LogOut className="mr-2 h-4 w-4" /> Sign out
        </Button>
      </aside>

      <main className="min-w-0 flex-1 p-8">
        <AdminHero view={view} />
        {view === "verification" && <Verification />}
        {view === "children" && <Children />}
        {view === "matching" && <Matching />}
      </main>
    </div>
  );
}

const HERO_LINE: Record<View, string> = {
  verification: "Check each licence before you verify a therapist.",
  children: "Everyone registered, across all caregivers.",
  matching: "Pair each request with the right verified therapist.",
};

function AdminHero({ view }: { view: View }) {
  const { data } = useQuery({
    queryKey: ["admin", "counts"],
    queryFn: async () => {
      const [waiting, toVerify, kids] = await Promise.all([
        supabase
          .from("requests")
          .select("id", { count: "exact", head: true })
          .in("status", ["pending", "declined"]),
        supabase
          .from("therapists")
          .select("user_id", { count: "exact", head: true })
          .eq("verified", false),
        supabase.from("patients").select("id", { count: "exact", head: true }),
      ]);
      return {
        waiting: waiting.count ?? 0,
        toVerify: toVerify.count ?? 0,
        kids: kids.count ?? 0,
      };
    },
  });

  const stats = [
    { label: "Requests waiting", value: data?.waiting },
    { label: "Therapists to verify", value: data?.toVerify },
    { label: "Children registered", value: data?.kids },
  ];

  return (
    <section className="nb-admin-hero mb-6 p-6">
      <p className="text-xs font-semibold uppercase tracking-wide text-[#F8E7C9]/75">
        {NAV.find((n) => n.id === view)?.label}
      </p>
      <p className="mt-1 max-w-lg text-sm text-[#F8E7C9]/90">{HERO_LINE[view]}</p>
      <div className="relative z-10 mt-4 flex flex-wrap gap-3">
        {stats.map((x) => (
          <div
            key={x.label}
            className="min-w-[8.5rem] rounded-xl bg-card/10 px-4 py-2.5 backdrop-blur"
          >
            <p className="text-2xl font-semibold leading-none">{x.value ?? "–"}</p>
            <p className="mt-1 text-[11px] font-medium text-[#F8E7C9]/80">{x.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Heading({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="mb-5">
      <h2 className="text-xl font-semibold">{title}</h2>
      <p className="text-sm text-muted-foreground">{hint}</p>
    </div>
  );
}

function Pill({ children, tone }: { children: React.ReactNode; tone: "ok" | "wait" | "idle" }) {
  const tones = {
    ok: "bg-[#064E3B]/10 text-[#064E3B]",
    wait: "bg-amber-200/70 text-amber-900",
    idle: "bg-black/5 text-muted-foreground",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
}

/* ── Verification queue ─────────────────────────────────────────────── */

function Verification() {
  const qc = useQueryClient();
  const [openId, setOpenId] = useState<string | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "therapists"],
    queryFn: async () => {
      const { data: therapists, error } = await supabase
        .from("therapists")
        .select("*")
        .order("verified", { ascending: true })
        .order("created_at", { ascending: false });
      if (error) throw error;
      const ids = (therapists ?? []).map((t) => t.user_id);
      const { data: profiles } = ids.length
        ? await supabase.from("profiles").select("id, full_name, phone").in("id", ids)
        : { data: [] };
      const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
      return (therapists ?? []).map((t) => ({ ...t, profile: byId.get(t.user_id) }));
    },
  });

  async function setVerified(userId: string, verified: boolean) {
    const { error } = await supabase.from("therapists").update({ verified }).eq("user_id", userId);
    if (error) return toast.error(error.message);
    toast.success(verified ? "Therapist verified" : "Verification removed");
    qc.invalidateQueries({ queryKey: ["admin"] });
  }

  return (
    <>
      <Heading
        title="Verification queue"
        hint="Check each licence with the professional regulator before you verify anyone."
      />
      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Profession</TableHead>
              <TableHead>Clinic</TableHead>
              <TableHead>Licence no.</TableHead>
              <TableHead>City</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={7} className="text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            )}
            {!isLoading && data?.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-muted-foreground">
                  No therapists have signed up yet.
                </TableCell>
              </TableRow>
            )}
            {data?.map((t) => (
              <TableRow key={t.user_id}>
                <TableCell className="font-medium">{t.profile?.full_name || "—"}</TableCell>
                <TableCell>{professionLabel(t.profession)}</TableCell>
                <TableCell>{t.clinic_name || "—"}</TableCell>
                <TableCell>{t.license_number || "—"}</TableCell>
                <TableCell>{t.city || "—"}</TableCell>
                <TableCell>
                  {t.verified ? (
                    <Pill tone="ok">Verified</Pill>
                  ) : t.profile_submitted_at || t.license_number ? (
                    <Pill tone="wait">Pending</Pill>
                  ) : (
                    <Pill tone="idle">No details yet</Pill>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Button size="sm" variant="ghost" onClick={() => setOpenId(t.user_id)}>
                      Details
                    </Button>
                    {t.verified ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setVerified(t.user_id, false)}
                      >
                        Remove
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        disabled={!t.license_number}
                        title={!t.license_number ? "Waiting for licence details" : undefined}
                        onClick={() => setVerified(t.user_id, true)}
                      >
                        <BadgeCheck className="mr-1 h-4 w-4" /> Verify
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <TherapistDetails
        therapist={data?.find((t) => t.user_id === openId) ?? null}
        onClose={() => setOpenId(null)}
      />
    </>
  );
}

/* ── Children list ──────────────────────────────────────────────────── */

function Children() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "children"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("patients")
        .select(
          "id, child_name, county, sub_county, gmfcs_level, claimed_by_caregiver_id, therapist_id, consent_at, created_at",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  return (
    <>
      <Heading title="Children" hint="Everyone registered, across all caregivers." />
      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Child</TableHead>
              <TableHead>County</TableHead>
              <TableHead>GMFCS</TableHead>
              <TableHead>Caregiver</TableHead>
              <TableHead>Therapist</TableHead>
              <TableHead>Consent</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={6} className="text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            )}
            {!isLoading && data?.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-muted-foreground">
                  No children registered yet.
                </TableCell>
              </TableRow>
            )}
            {data?.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.child_name}</TableCell>
                <TableCell>{[c.county, c.sub_county].filter(Boolean).join(", ") || "—"}</TableCell>
                <TableCell>{c.gmfcs_level ?? "—"}</TableCell>
                <TableCell>
                  {c.claimed_by_caregiver_id ? (
                    <Pill tone="ok">Linked</Pill>
                  ) : (
                    <Pill tone="idle">Not yet</Pill>
                  )}
                </TableCell>
                <TableCell>
                  {c.therapist_id ? <Pill tone="ok">Assigned</Pill> : <Pill tone="idle">None</Pill>}
                </TableCell>
                <TableCell>
                  {c.consent_at ? (
                    <Pill tone="ok">Recorded</Pill>
                  ) : (
                    <Pill tone="wait">Missing</Pill>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}

/* ── Matching: requests waiting for a therapist ─────────────────────── */

function Matching() {
  const qc = useQueryClient();
  const [pick, setPick] = useState<Record<string, string>>({});

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "matching"],
    queryFn: async () => {
      const [{ data: requests, error }, { data: verified }] = await Promise.all([
        supabase.from("requests").select("*").order("created_at", { ascending: false }),
        supabase.from("therapists").select("*").eq("verified", true),
      ]);
      if (error) throw error;
      const childIds = [...new Set((requests ?? []).map((r) => r.child_id))];
      const therapistIds = (verified ?? []).map((t) => t.user_id);
      const [{ data: kids }, { data: names }] = await Promise.all([
        childIds.length
          ? supabase.from("patients").select("id, child_name, county").in("id", childIds)
          : Promise.resolve({ data: [] }),
        therapistIds.length
          ? supabase.from("profiles").select("id, full_name").in("id", therapistIds)
          : Promise.resolve({ data: [] }),
      ]);
      return {
        requests: requests ?? [],
        kids: new Map((kids ?? []).map((k) => [k.id, k])),
        therapists: (verified ?? []).map((t) => ({
          ...t,
          name: (names ?? []).find((n) => n.id === t.user_id)?.full_name || t.clinic_name,
        })),
      };
    },
  });

  async function match(requestId: string) {
    const therapistId = pick[requestId];
    if (!therapistId) return toast.error("Choose a therapist first");
    const { data: me } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("requests")
      .update({ assigned_therapist_id: therapistId, status: "matched", approved_by: me.user?.id })
      .eq("id", requestId);
    if (error) return toast.error(error.message);
    toast.success("Request matched");
    qc.invalidateQueries({ queryKey: ["admin"] });
  }

  const statusTone = (s: string) =>
    s === "accepted" || s === "completed" ? "ok" : s === "declined" ? "idle" : "wait";

  return (
    <>
      <Heading
        title="Matching"
        hint="Requests from caregivers. Pick a verified therapist; they then accept or decline. Distances are estimates from the child's county centre."
      />
      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Child</TableHead>
              <TableHead>County</TableHead>
              <TableHead>Needs</TableHead>
              <TableHead>Funder</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Assign</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={6} className="text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            )}
            {!isLoading && data?.requests.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-muted-foreground">
                  No requests yet.
                </TableCell>
              </TableRow>
            )}
            {data?.requests.map((r) => {
              const kid = data.kids.get(r.child_id);
              const assigned = data.therapists.find((t) => t.user_id === r.assigned_therapist_id);
              return (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{kid?.child_name ?? "—"}</TableCell>
                  <TableCell>{kid?.county ?? "—"}</TableCell>
                  <TableCell>{r.needs.map(needLabel).join(", ") || "—"}</TableCell>
                  <TableCell className="capitalize">{r.funder}</TableCell>
                  <TableCell>
                    <Pill tone={statusTone(r.status)}>{r.status}</Pill>
                  </TableCell>
                  <TableCell className="text-right">
                    {r.status === "pending" || r.status === "declined" ? (
                      <div className="flex items-center justify-end gap-2">
                        <TherapistSelect
                          value={pick[r.id] ?? ""}
                          onChange={(v) => setPick((p) => ({ ...p, [r.id]: v }))}
                          therapists={data.therapists}
                          needs={r.needs}
                          county={kid?.county ?? null}
                        />
                        <Button size="sm" onClick={() => match(r.id)}>
                          Match
                        </Button>
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        {assigned?.name ?? "Assigned"}
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </>
  );
}

/* ── Therapist picker: best fits first ──────────────────────────────── */

type PickableTherapist = {
  user_id: string;
  name: string;
  city: string | null;
  profession: string | null;
  specializations: string[];
  home_lat: number | null;
  home_lng: number | null;
  radius_km: number | null;
  home_visits: boolean;
};

function TherapistSelect({
  value,
  onChange,
  therapists,
  needs,
  county,
}: {
  value: string;
  onChange: (v: string) => void;
  therapists: PickableTherapist[];
  needs: string[];
  county: string | null;
}) {
  const centre = county ? COUNTY_CENTROIDS[county] : undefined;

  const scored = therapists.map((t) => {
    const km =
      centre && t.home_lat != null && t.home_lng != null
        ? distanceKm(centre, { lat: t.home_lat, lng: t.home_lng })
        : null;
    const inRange = km != null && t.radius_km != null && km <= t.radius_km;
    const matchesNeed = needs.length === 0 || needs.some((n) => t.specializations.includes(n));
    const best = t.home_visits && inRange && matchesNeed;
    return { t, km, inRange, matchesNeed, best };
  });

  const byDistance = (a: (typeof scored)[number], b: (typeof scored)[number]) =>
    (a.km ?? 1e9) - (b.km ?? 1e9);
  const best = scored.filter((x) => x.best).sort(byDistance);
  const others = scored.filter((x) => !x.best).sort(byDistance);

  const label = (x: (typeof scored)[number]) => {
    const parts = [
      `${x.t.name}`,
      professionLabel(x.t.profession),
      x.t.city,
      x.km != null ? `about ${Math.round(x.km)} km away` : "distance unknown",
      x.t.radius_km != null ? `works within ${x.t.radius_km} km` : null,
    ];
    const flags = [
      !x.t.home_visits ? "clinic only" : null,
      x.km != null && !x.inRange ? "outside their area" : null,
      !x.matchesNeed ? "different speciality" : null,
    ].filter(Boolean);
    return parts.filter(Boolean).join(" · ") + (flags.length ? ` (${flags.join(", ")})` : "");
  };

  return (
    <select
      className="max-w-[28rem] rounded-md border border-input bg-card px-2 py-1 text-sm"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">
        {therapists.length === 0 ? "No verified therapists yet" : "Choose therapist…"}
      </option>
      {best.length > 0 && (
        <optgroup label="Best fits (in range, right speciality, home visits)">
          {best.map((x) => (
            <option key={x.t.user_id} value={x.t.user_id}>
              {label(x)}
            </option>
          ))}
        </optgroup>
      )}
      {others.length > 0 && (
        <optgroup label={best.length > 0 ? "Other verified therapists" : "Verified therapists"}>
          {others.map((x) => (
            <option key={x.t.user_id} value={x.t.user_id}>
              {label(x)}
            </option>
          ))}
        </optgroup>
      )}
    </select>
  );
}

/* ── Therapist details + licence document ───────────────────────────── */

type TherapistRow = {
  user_id: string;
  clinic_name: string;
  license_number: string | null;
  license_body: string | null;
  license_document_path: string | null;
  profession: string | null;
  county: string | null;
  city: string | null;
  radius_km: number | null;
  home_visits: boolean;
  specializations: string[];
  available_days: string[];
  languages: string[];
  verified: boolean;
  profile_submitted_at: string | null;
  profile?: { full_name: string; phone: string | null };
};

function TherapistDetails({
  therapist: t,
  onClose,
}: {
  therapist: TherapistRow | null;
  onClose: () => void;
}) {
  const [opening, setOpening] = useState(false);

  async function openDocument() {
    if (!t?.license_document_path) return;
    setOpening(true);
    try {
      // A private link that stops working after 5 minutes.
      const { data, error } = await supabase.storage
        .from("therapist-docs")
        .createSignedUrl(t.license_document_path, 300);
      if (error || !data) return toast.error(error?.message ?? "Could not open the document");
      window.open(data.signedUrl, "_blank", "noopener");
    } finally {
      setOpening(false);
    }
  }

  const label = (list: readonly { value: string; label: string }[], values: string[]) =>
    values.map((v) => list.find((x) => x.value === v)?.label ?? v).join(", ") || "—";

  const rows: [string, React.ReactNode][] = t
    ? [
        ["Profession", professionLabel(t.profession)],
        ["Clinic", t.clinic_name || "—"],
        ["Licence number", t.license_number || "—"],
        ["Issued by", t.license_body || "—"],
        ["Phone", t.profile?.phone || "—"],
        ["Works from", [t.city, t.county].filter(Boolean).join(", ") || "—"],
        [
          "Travels up to",
          t.radius_km
            ? `${t.radius_km} km${t.home_visits ? "" : " (clinic only, no home visits)"}`
            : "—",
        ],
        ["Offers", t.specializations.map(needLabelSafe).join(", ") || "—"],
        ["Days", label(WEEKDAYS, t.available_days)],
        ["Languages", label(THERAPIST_LANGUAGES, t.languages)],
        [
          "Details sent",
          t.profile_submitted_at
            ? new Date(t.profile_submitted_at).toLocaleDateString()
            : "Not yet",
        ],
      ]
    : [];

  return (
    <Dialog open={!!t} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t?.profile?.full_name || "Therapist"}</DialogTitle>
          <DialogDescription>
            Compare the licence number and document with the professional body before verifying.
          </DialogDescription>
        </DialogHeader>
        <dl className="divide-y divide-border text-sm">
          {rows.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4 py-2">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="text-right font-medium">{v}</dd>
            </div>
          ))}
        </dl>
        <Button onClick={openDocument} disabled={!t?.license_document_path || opening}>
          {t?.license_document_path ? "Open licence document" : "No document uploaded"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}

const needLabelSafe = (v: string) => needLabel(v);
