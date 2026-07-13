import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { LogOut, Users, KeyRound, PlayCircle, HeartPulse } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/app/caregiver")({
  head: () => ({
    meta: [{ title: "Home — Neuro-Bridge" }],
  }),
  component: CaregiverHome,
});

function CaregiverHome() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: patients, isLoading } = useQuery({
    queryKey: ["my-patients"],
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
      <header className="border-b border-border bg-card/60 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground font-display text-lg">
              N
            </span>
            <div>
              <p className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
                <HeartPulse className="h-4 w-4" /> Caregiver
              </p>
              <p className="font-display text-lg leading-none">Home</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={handleSignOut}>
            <LogOut className="mr-2 h-4 w-4" /> Sign out
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-8">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : !patients || patients.length === 0 ? (
          <ClaimForm />
        ) : (
          <div className="space-y-6">
            <div>
              <h1 className="font-display text-3xl">Welcome back</h1>
              <p className="text-sm text-muted-foreground">
                Continue today's therapy plan.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {patients.map((p) => (
                <div
                  key={p.id}
                  className="rounded-3xl border border-border bg-card p-5 shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <div className="grid h-11 w-11 place-items-center rounded-2xl bg-accent text-accent-foreground">
                      <Users className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-display text-xl">{p.child_name}</p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {p.affected_side} side ·{" "}
                        {p.gmfcs_level ? `GMFCS ${p.gmfcs_level}` : "level TBD"}
                      </p>
                    </div>
                  </div>
                  <a
                    href="/neuro-bridge/index.html"
                    className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                  >
                    <PlayCircle className="h-4 w-4" /> Start therapy
                  </a>
                </div>
              ))}
              <ClaimForm compact />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function ClaimForm({ compact = false }: { compact?: boolean }) {
  const qc = useQueryClient();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const claim = code.trim().toUpperCase();
      if (claim.length !== 8) {
        toast.error("Enter the 8-character code from your therapist");
        return;
      }
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      // Find the patient by claim code (RLS allows reading unclaimed rows via the update path)
      const { data: found, error: findErr } = await supabase
        .from("patients")
        .update({
          claimed_by_caregiver_id: userData.user.id,
          claimed_at: new Date().toISOString(),
        })
        .eq("claim_code", claim)
        .is("claimed_by_caregiver_id", null)
        .select()
        .maybeSingle();

      if (findErr) {
        toast.error(findErr.message);
        return;
      }
      if (!found) {
        toast.error("Code not found or already used");
        return;
      }
      toast.success(`Linked to ${found.child_name}`);
      qc.invalidateQueries({ queryKey: ["my-patients"] });
      setCode("");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className={`rounded-3xl border border-dashed border-border bg-card p-6 ${
        compact ? "" : "mt-2"
      }`}
    >
      <div className="grid h-11 w-11 place-items-center rounded-2xl bg-accent text-accent-foreground">
        <KeyRound className="h-5 w-5" />
      </div>
      <h3 className="mt-4 font-display text-xl">
        {compact ? "Link another child" : "Enter your child's claim code"}
      </h3>
      <p className="mt-2 text-sm text-muted-foreground">
        Your therapist gave you an 8-character code. Enter it here to link your
        account to your child's plan.
      </p>
      <form onSubmit={submit} className="mt-4 flex flex-col gap-3 sm:flex-row">
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="claim">Claim code</Label>
          <Input
            id="claim"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            maxLength={8}
            placeholder="e.g. K7HN23PB"
            className="font-mono tracking-widest"
          />
        </div>
        <Button type="submit" className="sm:self-end" disabled={loading}>
          {loading ? "Linking…" : "Link account"}
        </Button>
      </form>
    </div>
  );
}
