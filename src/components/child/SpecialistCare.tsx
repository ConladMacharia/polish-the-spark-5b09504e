import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Clock, HeartHandshake, Loader2, Send, UserCheck } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { AmbientBlobs, Chip, GlassCard, SectionLabel } from "@/components/ui/glass";
import { FUNDERS, SPECIALIST_NEEDS, needLabel } from "@/lib/kenya";

type Child = {
  id?: string;
  child_name?: string | null;
  county?: string | null;
  consent_at?: string | null;
} | null;

const OPEN = ["pending", "matched", "accepted"];

/** Plain-language status line for the caregiver. */
const STATUS_TEXT: Record<string, { title: string; body: string }> = {
  pending: {
    title: "Request sent",
    body: "We're finding a verified therapist near you. You don't need to do anything.",
  },
  matched: {
    title: "Therapist found",
    body: "A therapist has been chosen and is confirming they can take your child.",
  },
  accepted: {
    title: "Therapist confirmed",
    body: "A therapist has accepted. They will contact you to arrange a visit.",
  },
  declined: {
    title: "Finding another therapist",
    body: "That therapist couldn't take your child. We're looking for another one.",
  },
  completed: {
    title: "Care completed",
    body: "This round of specialist care is finished. You can ask for more support any time.",
  },
};

export function SpecialistCare({
  patient,
  onEditProfile,
}: {
  patient: Child | undefined;
  onEditProfile: () => void;
}) {
  const [open, setOpen] = useState(false);
  const childId = patient?.id;

  const { data: requests, isLoading } = useQuery({
    queryKey: ["my-requests", childId],
    enabled: !!childId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("requests")
        .select("*")
        .eq("child_id", childId as string)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  if (!childId) return null;

  const latest = requests?.[0];
  // A "declined" request is still being worked on by the coordinator.
  const inProgress = !!latest && (OPEN.includes(latest.status) || latest.status === "declined");
  const ready = !!patient?.county && !!patient?.consent_at;
  const status = latest ? STATUS_TEXT[latest.status] : null;

  return (
    <>
      <GlassCard tint="neutral" className="mt-3 p-4">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-300/90">
            <HeartHandshake className="h-5 w-5 text-emerald-950" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-display text-[11px] font-semibold uppercase tracking-wide text-emerald-300">
              Specialist care
            </p>

            {isLoading && <p className="mt-1 text-[12px] text-stone-400">Checking…</p>}

            {!isLoading && status && (
              <div className="mt-1">
                <h4 className="flex items-center gap-1.5 font-display text-base font-bold text-stone-50">
                  {latest?.status === "pending" || latest?.status === "declined" ? (
                    <Clock className="h-4 w-4 text-amber-300" />
                  ) : latest?.status === "matched" ? (
                    <UserCheck className="h-4 w-4 text-emerald-300" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                  )}
                  {status.title}
                </h4>
                <p className="mt-1 text-[12px] font-medium leading-relaxed text-stone-300">
                  {status.body}
                </p>
                {latest && (
                  <p className="mt-1.5 text-[11px] text-stone-400">
                    {latest.needs.map(needLabel).join(", ")}
                  </p>
                )}
              </div>
            )}

            {!isLoading && !latest && (
              <p className="mt-1 text-[12px] font-medium leading-relaxed text-stone-300">
                Need an occupational therapist or physiotherapist to visit? Send a request and we
                will look for a verified specialist near you.
              </p>
            )}

            {!isLoading && !inProgress && (
              <>
                {ready ? (
                  <button
                    type="button"
                    onClick={() => setOpen(true)}
                    className="mt-3 inline-flex items-center gap-2 rounded-full bg-emerald-300 px-5 py-2.5 font-display text-sm font-bold text-emerald-950 transition-opacity hover:opacity-90"
                  >
                    <Send className="h-4 w-4" /> Request specialist
                  </button>
                ) : (
                  <>
                    <p className="mt-2 text-[12px] font-medium text-amber-200">
                      First add your county and tick the sharing agreement in your child's profile.
                    </p>
                    <button
                      type="button"
                      onClick={onEditProfile}
                      className="mt-2 inline-flex items-center gap-2 rounded-full border border-emerald-200/30 bg-white/10 px-5 py-2.5 font-display text-sm font-bold text-emerald-200"
                    >
                      Complete profile
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </GlassCard>

      <RequestSheet open={open} onOpenChange={setOpen} patient={patient} />
    </>
  );
}

function RequestSheet({
  open,
  onOpenChange,
  patient,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  patient: Child | undefined;
}) {
  const qc = useQueryClient();
  const [needs, setNeeds] = useState<string[]>([]);
  const [funder, setFunder] = useState<string>("self");
  const [notes, setNotes] = useState("");

  const send = useMutation({
    mutationFn: async () => {
      if (!patient?.id) throw new Error("No child profile yet");
      if (needs.length === 0) throw new Error("Choose at least one kind of help");
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Please sign in again");
      const { error } = await supabase.from("requests").insert({
        child_id: patient.id,
        created_by: userData.user.id,
        needs,
        funder,
        notes: notes.trim() || null,
      });
      if (error) {
        // The database allows only one open request per child.
        if (error.code === "23505") throw new Error("You already have a request in progress.");
        throw error;
      }
    },
    onSuccess: async () => {
      toast.success("Request sent");
      setNeeds([]);
      setNotes("");
      setFunder("self");
      await qc.invalidateQueries({ queryKey: ["my-requests", patient?.id] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = (v: string) =>
    setNeeds((cur) => (cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[92vh] overflow-y-auto rounded-t-3xl border-t border-white/10 bg-emerald-950 p-0 text-stone-50 sm:mx-auto sm:max-w-lg"
      >
        <div className="relative overflow-hidden border-b border-white/10 bg-gradient-to-br from-emerald-900 to-emerald-950 px-6 py-5">
          <AmbientBlobs />
          <SheetHeader className="relative space-y-1 text-left">
            <SheetTitle className="font-display text-2xl text-stone-50">
              Request a specialist
            </SheetTitle>
            <SheetDescription className="text-sm font-medium text-stone-300">
              For {patient?.child_name || "your child"}
              {patient?.county ? ` · ${patient.county}` : ""}
            </SheetDescription>
          </SheetHeader>
        </div>

        <form
          className="space-y-6 px-6 py-6"
          onSubmit={(e) => {
            e.preventDefault();
            send.mutate();
          }}
        >
          <div className="space-y-2">
            <SectionLabel>What help do you need? (choose any)</SectionLabel>
            <div className="flex flex-wrap gap-2">
              {SPECIALIST_NEEDS.map((n) => (
                <Chip
                  key={n.value}
                  active={needs.includes(n.value)}
                  onClick={() => toggle(n.value)}
                >
                  {n.label}
                </Chip>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <SectionLabel>Who will pay?</SectionLabel>
            <div className="flex flex-wrap gap-2">
              {FUNDERS.map((f) => (
                <Chip key={f.value} active={funder === f.value} onClick={() => setFunder(f.value)}>
                  {f.label}
                </Chip>
              ))}
            </div>
            <p className="text-[11px] text-stone-400">
              This only helps us arrange things. Nothing is charged through the app.
            </p>
          </div>

          <div className="space-y-2">
            <SectionLabel>Anything the therapist should know? (optional)</SectionLabel>
            <GlassCard tint="neutral" className="p-1">
              <Textarea
                rows={3}
                maxLength={500}
                value={notes}
                placeholder="e.g. Best days are Tuesday and Thursday"
                onChange={(e) => setNotes(e.target.value)}
                className="resize-none border-0 bg-transparent font-medium text-stone-100 placeholder:text-stone-500 focus-visible:ring-0"
              />
            </GlassCard>
          </div>

          <button
            type="submit"
            disabled={send.isPending || needs.length === 0}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-emerald-300 py-3.5 font-display text-base font-bold text-emerald-950 transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {send.isPending ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
            Send request
          </button>
        </form>
      </SheetContent>
    </Sheet>
  );
}

export default SpecialistCare;
