import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  Check,
  ClipboardList,
  Lock,
  MapPin,
  Phone,
  User,
  X,
  CalendarPlus,
  BadgeCheck,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LogVisitDialog } from "@/components/therapist/LogVisitDialog";
import { useMyTherapist, ageFromDob } from "@/lib/therapist";
import { needLabel, FUNDERS } from "@/lib/kenya";

export const Route = createFileRoute("/_authenticated/app/therapist/requests")({
  head: () => ({ meta: [{ title: "Requests — Neuro-Bridge" }] }),
  component: Requests,
});

type Row = {
  id: string;
  child_id: string;
  status: string;
  needs: string[];
  funder: string;
  notes: string | null;
  created_at: string;
};

function Requests() {
  const qc = useQueryClient();
  const { data: me, isLoading: meLoading } = useMyTherapist();
  const verified = !!me?.verified;

  const { data, isLoading } = useQuery({
    queryKey: ["therapist-requests"],
    enabled: verified,
    queryFn: async () => {
      const { data: requests, error } = await supabase
        .from("requests")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const rows = (requests ?? []) as Row[];
      const childIds = [...new Set(rows.map((r) => r.child_id))];
      const { data: kids } = childIds.length
        ? await supabase
            .from("patients")
            .select(
              "id, child_name, date_of_birth, gmfcs_level, affected_side, county, sub_county, ward, claimed_by_caregiver_id",
            )
            .in("id", childIds)
        : { data: [] };
      const kidMap = new Map((kids ?? []).map((k) => [k.id, k]));
      // Caregiver contact is only readable after the request is accepted.
      const caregiverIds = [
        ...new Set((kids ?? []).map((k) => k.claimed_by_caregiver_id).filter(Boolean)),
      ] as string[];
      const { data: people } = caregiverIds.length
        ? await supabase.from("profiles").select("id, full_name, phone").in("id", caregiverIds)
        : { data: [] };
      const personMap = new Map((people ?? []).map((p) => [p.id, p]));
      return rows.map((r) => {
        const kid = kidMap.get(r.child_id);
        return {
          ...r,
          kid,
          caregiver: kid?.claimed_by_caregiver_id
            ? personMap.get(kid.claimed_by_caregiver_id)
            : undefined,
        };
      });
    },
  });

  const respond = useMutation({
    mutationFn: async ({
      id,
      status,
    }: {
      id: string;
      status: "accepted" | "declined" | "completed";
    }) => {
      const { data: changed, error } = await supabase
        .from("requests")
        .update({ status })
        .eq("id", id)
        .select("id");
      if (error) throw error;
      if (!changed || changed.length === 0) {
        throw new Error("You can answer requests once your account is verified.");
      }
    },
    onSuccess: async (_d, v) => {
      toast.success(
        v.status === "accepted"
          ? "Request accepted"
          : v.status === "declined"
            ? "Request declined"
            : "Care marked complete",
      );
      await qc.invalidateQueries({ queryKey: ["therapist-requests"] });
      await qc.invalidateQueries({ queryKey: ["therapist-waiting-count"] });
      await qc.invalidateQueries({ queryKey: ["therapist-accepted"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (meLoading)
    return (
      <Shell>
        <p className="text-sm text-muted-foreground">Loading…</p>
      </Shell>
    );

  if (!verified) {
    return (
      <Shell>
        <Hero title="Requests" line="Locked until your account is verified" />
        <div className="mt-6 rounded-3xl border border-dashed border-border bg-card p-10 text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-secondary text-primary">
            <Lock className="h-6 w-6" />
          </div>
          <h3 className="mt-4 font-display text-xl">Almost there</h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            A coordinator is checking your licence. When you are verified, new requests from
            families near you will appear here.
          </p>
        </div>
      </Shell>
    );
  }

  const rows = data ?? [];
  const fresh = rows.filter((r) => r.status === "matched");
  const active = rows.filter((r) => r.status === "accepted");
  const past = rows.filter((r) => r.status === "completed" || r.status === "declined");

  return (
    <Shell>
      <Hero
        title="Requests"
        line={
          fresh.length > 0
            ? `${fresh.length} new ${fresh.length === 1 ? "request is" : "requests are"} waiting for your answer`
            : "You're all caught up"
        }
        stats={[
          { label: "New", value: fresh.length },
          { label: "Active", value: active.length },
          { label: "Finished", value: past.length },
        ]}
      />

      {isLoading && <p className="mt-6 text-sm text-muted-foreground">Loading…</p>}

      {!isLoading && rows.length === 0 && (
        <div className="mt-6 rounded-3xl border border-dashed border-border bg-card p-10 text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-secondary text-primary">
            <ClipboardList className="h-6 w-6" />
          </div>
          <h3 className="mt-4 font-display text-xl">No requests yet</h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            When a coordinator matches a child to you, the request shows up here. You then accept or
            decline.
          </p>
        </div>
      )}

      <Group title="New — needs your answer" rows={fresh}>
        {(r) => (
          <div className="flex flex-wrap gap-2">
            <Button
              className="rounded-full"
              disabled={respond.isPending}
              onClick={() => respond.mutate({ id: r.id, status: "accepted" })}
            >
              <Check className="mr-1.5 h-4 w-4" /> Accept
            </Button>
            <Button
              variant="outline"
              className="rounded-full"
              disabled={respond.isPending}
              onClick={() => respond.mutate({ id: r.id, status: "declined" })}
            >
              <X className="mr-1.5 h-4 w-4" /> Decline
            </Button>
          </div>
        )}
      </Group>

      <Group title="Active" rows={active}>
        {(r) => (
          <div className="flex flex-wrap gap-2">
            <LogVisitDialog
              requestId={r.id}
              trigger={
                <Button className="rounded-full">
                  <CalendarPlus className="mr-1.5 h-4 w-4" /> Log a visit
                </Button>
              }
            />
            <Button
              variant="outline"
              className="rounded-full"
              disabled={respond.isPending}
              onClick={() => {
                if (
                  window.confirm(
                    "Mark this care as finished? You will no longer be able to log visits for it.",
                  )
                ) {
                  respond.mutate({ id: r.id, status: "completed" });
                }
              }}
            >
              <BadgeCheck className="mr-1.5 h-4 w-4" /> Mark complete
            </Button>
          </div>
        )}
      </Group>

      <Group title="Finished" rows={past} muted>
        {() => null}
      </Group>
    </Shell>
  );
}

/* ── pieces ─────────────────────────────────────────────────────────── */

function Shell({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6">{children}</main>;
}

function Hero({
  title,
  line,
  stats,
}: {
  title: string;
  line: string;
  stats?: { label: string; value: number }[];
}) {
  return (
    <section className="nb-hero p-6">
      <p className="text-xs font-semibold uppercase tracking-wide text-white/75">Therapist</p>
      <h1 className="font-display text-3xl">{title}</h1>
      <p className="mt-1 max-w-md text-sm text-white/90">{line}</p>
      {stats && (
        <div className="relative z-10 mt-5 flex gap-3">
          {stats.map((s) => (
            <div
              key={s.label}
              className="min-w-[4.5rem] rounded-2xl bg-white/15 px-3 py-2 backdrop-blur"
            >
              <p className="font-display text-2xl leading-none">{s.value}</p>
              <p className="mt-1 text-[11px] font-medium text-white/80">{s.label}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

type Full = Row & {
  kid?: {
    child_name: string;
    date_of_birth: string | null;
    gmfcs_level: string | null;
    affected_side: string | null;
    county: string | null;
    sub_county: string | null;
    ward: string | null;
  };
  caregiver?: { full_name: string; phone: string | null };
};

function Group({
  title,
  rows,
  muted,
  children,
}: {
  title: string;
  rows: Full[];
  muted?: boolean;
  children: (r: Full) => React.ReactNode;
}) {
  if (rows.length === 0) return null;
  return (
    <section className="mt-8">
      <h2 className="mb-3 font-display text-lg">{title}</h2>
      <div className="grid gap-4">
        {rows.map((r) => (
          <RequestCard key={r.id} r={r} muted={muted}>
            {children(r)}
          </RequestCard>
        ))}
      </div>
    </section>
  );
}

function RequestCard({
  r,
  muted,
  children,
}: {
  r: Full;
  muted?: boolean;
  children: React.ReactNode;
}) {
  const kid = r.kid;
  const age = ageFromDob(kid?.date_of_birth);
  const area = [kid?.ward, kid?.sub_county, kid?.county].filter(Boolean).join(", ");
  const funder = FUNDERS.find((f) => f.value === r.funder)?.label ?? r.funder;
  const accepted = r.status === "accepted" || r.status === "completed";

  return (
    <article
      className={`rounded-3xl border border-border bg-card p-5 shadow-sm ${muted ? "opacity-75" : ""}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-display text-xl">{kid?.child_name ?? "Child"}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {[
              age,
              kid?.gmfcs_level ? `GMFCS ${kid.gmfcs_level}` : null,
              kid?.affected_side && kid.affected_side !== "none"
                ? `${kid.affected_side} side`
                : null,
            ]
              .filter(Boolean)
              .join(" · ") || "Details not added yet"}
          </p>
        </div>
        <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold capitalize text-secondary-foreground">
          {r.status === "matched" ? "new" : r.status}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {r.needs.map((n) => (
          <span
            key={n}
            className="rounded-full bg-accent px-2.5 py-1 text-xs font-medium text-accent-foreground"
          >
            {needLabel(n)}
          </span>
        ))}
      </div>

      <div className="mt-3 space-y-1.5 text-sm text-muted-foreground">
        {area && (
          <p className="flex items-center gap-2">
            <MapPin className="h-4 w-4 shrink-0 text-primary" /> {area}
          </p>
        )}
        <p className="flex items-center gap-2">
          <User className="h-4 w-4 shrink-0 text-primary" /> Paid by: {funder}
        </p>
        {accepted ? (
          <p className="flex items-center gap-2">
            <Phone className="h-4 w-4 shrink-0 text-primary" />
            {r.caregiver ? (
              <span>
                {r.caregiver.full_name || "Caregiver"}
                {r.caregiver.phone ? (
                  <>
                    {" · "}
                    <a
                      href={`tel:${r.caregiver.phone}`}
                      className="font-semibold text-primary underline-offset-2 hover:underline"
                    >
                      {r.caregiver.phone}
                    </a>
                  </>
                ) : (
                  " · no phone number added"
                )}
              </span>
            ) : (
              <span>Caregiver contact not available</span>
            )}
          </p>
        ) : (
          <p className="flex items-center gap-2 text-xs">
            <Lock className="h-3.5 w-3.5 shrink-0" /> Contact details appear after you accept.
          </p>
        )}
      </div>

      {r.notes && (
        <p className="mt-3 rounded-2xl bg-secondary p-3 text-sm text-secondary-foreground">
          “{r.notes}”
        </p>
      )}

      <div className="mt-4">{children}</div>
    </article>
  );
}
