import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { BadgeCheck, GitMerge, LogOut, ShieldCheck, Users } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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

// Neutral, data-first look. Colors are plain slate for now and will be
// swapped for the Neuro-Bridge palette in one pass.
function AdminShell() {
  const [view, setView] = useState<View>("verification");
  const navigate = useNavigate();
  const qc = useQueryClient();

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      <aside className="flex w-60 shrink-0 flex-col border-r border-slate-200 bg-white p-4">
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
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
                view === id ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </nav>
        <Button variant="ghost" className="justify-start text-slate-600" onClick={signOut}>
          <LogOut className="mr-2 h-4 w-4" /> Sign out
        </Button>
      </aside>

      <main className="min-w-0 flex-1 p-8">
        {view === "verification" && <Verification />}
        {view === "children" && <Children />}
        {view === "matching" && <Matching />}
      </main>
    </div>
  );
}

function Heading({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="mb-5">
      <h2 className="text-xl font-semibold">{title}</h2>
      <p className="text-sm text-slate-500">{hint}</p>
    </div>
  );
}

function Pill({ children, tone }: { children: React.ReactNode; tone: "ok" | "wait" | "idle" }) {
  const tones = {
    ok: "bg-emerald-100 text-emerald-800",
    wait: "bg-amber-100 text-amber-800",
    idle: "bg-slate-100 text-slate-600",
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
      <div className="rounded-lg border border-slate-200 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
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
                <TableCell colSpan={6} className="text-slate-500">
                  Loading…
                </TableCell>
              </TableRow>
            )}
            {!isLoading && data?.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-slate-500">
                  No therapists have signed up yet.
                </TableCell>
              </TableRow>
            )}
            {data?.map((t) => (
              <TableRow key={t.user_id}>
                <TableCell className="font-medium">{t.profile?.full_name || "—"}</TableCell>
                <TableCell>{t.clinic_name}</TableCell>
                <TableCell>{t.license_number || "—"}</TableCell>
                <TableCell>{t.city || "—"}</TableCell>
                <TableCell>
                  {t.verified ? <Pill tone="ok">Verified</Pill> : <Pill tone="wait">Pending</Pill>}
                </TableCell>
                <TableCell className="text-right">
                  {t.verified ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setVerified(t.user_id, false)}
                    >
                      Remove
                    </Button>
                  ) : (
                    <Button size="sm" onClick={() => setVerified(t.user_id, true)}>
                      <BadgeCheck className="mr-1 h-4 w-4" /> Verify
                    </Button>
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
      <div className="rounded-lg border border-slate-200 bg-white">
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
                <TableCell colSpan={6} className="text-slate-500">
                  Loading…
                </TableCell>
              </TableRow>
            )}
            {!isLoading && data?.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-slate-500">
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
        supabase.from("therapists").select("user_id, clinic_name, city").eq("verified", true),
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
        hint="Requests from caregivers. Pick a verified therapist; they then accept or decline."
      />
      <div className="rounded-lg border border-slate-200 bg-white">
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
                <TableCell colSpan={6} className="text-slate-500">
                  Loading…
                </TableCell>
              </TableRow>
            )}
            {!isLoading && data?.requests.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-slate-500">
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
                  <TableCell>{r.needs.join(", ") || "—"}</TableCell>
                  <TableCell className="capitalize">{r.funder}</TableCell>
                  <TableCell>
                    <Pill tone={statusTone(r.status)}>{r.status}</Pill>
                  </TableCell>
                  <TableCell className="text-right">
                    {r.status === "pending" ? (
                      <div className="flex items-center justify-end gap-2">
                        <select
                          className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm"
                          value={pick[r.id] ?? ""}
                          onChange={(e) => setPick((p) => ({ ...p, [r.id]: e.target.value }))}
                        >
                          <option value="">Choose therapist…</option>
                          {data.therapists.map((t) => (
                            <option key={t.user_id} value={t.user_id}>
                              {t.name}
                              {t.city ? ` — ${t.city}` : ""}
                            </option>
                          ))}
                        </select>
                        <Button size="sm" onClick={() => match(r.id)}>
                          Match
                        </Button>
                      </div>
                    ) : (
                      <span className="text-sm text-slate-500">{assigned?.name ?? "Assigned"}</span>
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
