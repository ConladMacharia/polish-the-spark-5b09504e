import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

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

const today = () => new Date().toISOString().slice(0, 10);

/**
 * "Log a visit" form. Children come from requests this therapist has accepted.
 * Pass `requestId` to pre-select a child (used from the Requests page).
 */
export function LogVisitDialog({
  requestId,
  trigger,
}: {
  requestId?: string;
  trigger?: React.ReactNode;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [pick, setPick] = useState<string>(requestId ?? "");
  const [date, setDate] = useState(today());
  const [activities, setActivities] = useState("");
  const [notes, setNotes] = useState("");
  const [nextReview, setNextReview] = useState("");

  const { data: accepted, isLoading } = useQuery({
    queryKey: ["therapist-accepted"],
    enabled: open,
    queryFn: async () => {
      const { data: reqs, error } = await supabase
        .from("requests")
        .select("id, child_id")
        .eq("status", "accepted");
      if (error) throw error;
      const ids = (reqs ?? []).map((r) => r.child_id);
      const { data: kids } = ids.length
        ? await supabase.from("patients").select("id, child_name").in("id", ids)
        : { data: [] };
      const names = new Map((kids ?? []).map((k) => [k.id, k.child_name]));
      return (reqs ?? []).map((r) => ({ ...r, name: names.get(r.child_id) ?? "Child" }));
    },
  });

  const chosen = accepted?.find((r) => r.id === (pick || requestId));

  const save = useMutation({
    mutationFn: async () => {
      if (!chosen) throw new Error("Choose which child you visited");
      if (!activities.trim()) throw new Error("Write what you did in the visit");
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Please sign in again");
      const { error } = await supabase.from("visits").insert({
        request_id: chosen.id,
        child_id: chosen.child_id,
        therapist_id: userData.user.id,
        visit_date: date || today(),
        activities: activities.trim(),
        milestone_notes: notes.trim() || null,
        next_review: nextReview || null,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("Visit saved");
      setActivities("");
      setNotes("");
      setNextReview("");
      setDate(today());
      await qc.invalidateQueries({ queryKey: ["therapist-visits"] });
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button className="rounded-full">
            <Plus className="mr-2 h-4 w-4" /> Log a visit
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Log a visit</DialogTitle>
          <DialogDescription>
            A short record of what happened. The child's caregiver can read it.
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <div className="space-y-1.5">
            <Label>Child</Label>
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : !accepted || accepted.length === 0 ? (
              <p className="rounded-xl bg-secondary p-3 text-sm text-secondary-foreground">
                You have no accepted requests yet. Accept a request first, then you can log visits.
              </p>
            ) : (
              <Select value={pick || requestId || ""} onValueChange={setPick}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a child" />
                </SelectTrigger>
                <SelectContent>
                  {accepted.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="visit-date">Visit date</Label>
              <Input
                id="visit-date"
                type="date"
                value={date}
                max={today()}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="next-review">Next review (optional)</Label>
              <Input
                id="next-review"
                type="date"
                value={nextReview}
                min={date}
                onChange={(e) => setNextReview(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="activities">What did you do?</Label>
            <Textarea
              id="activities"
              rows={3}
              maxLength={2000}
              value={activities}
              onChange={(e) => setActivities(e.target.value)}
              placeholder="e.g. Hand opening and reaching practice, positioning at home"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="milestones">Progress and milestones (optional)</Label>
            <Textarea
              id="milestones"
              rows={3}
              maxLength={2000}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Reached for a cup twice with the left hand"
            />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={save.isPending || !chosen} className="rounded-full">
              {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save visit
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
