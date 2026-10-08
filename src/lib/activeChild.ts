import { useCallback, useSyncExternalStore } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Child = Database["public"]["Tables"]["patients"]["Row"];

export const CHILDREN_KEY = ["my-children"] as const;

// ---- which child is selected (remembered on this device) ----
const STORAGE_KEY = "nb-active-child";
const listeners = new Set<() => void>();

function read(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function getActiveChildId(): string | null {
  return typeof window === "undefined" ? null : read();
}

export function setActiveChildId(id: string | null) {
  try {
    if (id) window.localStorage.setItem(STORAGE_KEY, id);
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* storage blocked: selection just won't be remembered */
  }
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

// ---- data ----
function cryptoRandomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  const arr = new Uint8Array(8);
  crypto.getRandomValues(arr);
  for (let i = 0; i < 8; i++) out += chars[arr[i] % chars.length];
  return out;
}

async function createChild(uid: string, name: string): Promise<Child> {
  const { data: prof } = await supabase
    .from("profiles")
    .select("preferred_language")
    .eq("id", uid)
    .maybeSingle();
  const { data, error } = await supabase
    .from("patients")
    .insert({
      claimed_by_caregiver_id: uid,
      claimed_at: new Date().toISOString(),
      child_name: name,
      affected_side: "bilateral",
      preferred_language: (prof?.preferred_language as "en" | "sw" | "ki") ?? "en",
      goals: [],
      claim_code: cryptoRandomCode(),
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function fetchChildren(): Promise<Child[]> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) return [];

  const { data } = await supabase
    .from("patients")
    .select("*")
    .eq("claimed_by_caregiver_id", uid)
    .order("created_at", { ascending: true });
  if (data && data.length > 0) return data;

  // First visit: make a starter profile so the caregiver can begin straight away.
  const { data: prof } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", uid)
    .maybeSingle();
  const first = prof?.full_name?.split(" ")[0];
  return [await createChild(uid, first ? `${first}'s child` : "My child")];
}

/** The caregiver's children and the one currently selected. */
export function useActiveChild() {
  const qc = useQueryClient();
  const storedId = useSyncExternalStore(subscribe, read, () => null);
  const { data: children = [], isLoading } = useQuery({
    queryKey: CHILDREN_KEY,
    queryFn: fetchChildren,
  });

  const patient: Child | undefined = children.find((c) => c.id === storedId) ?? children[0];

  const select = useCallback((id: string) => setActiveChildId(id), []);

  const add = useCallback(
    async (name: string) => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error("Please sign in again");
      const child = await createChild(uid, name.trim() || "My child");
      await qc.invalidateQueries({ queryKey: CHILDREN_KEY });
      setActiveChildId(child.id);
      return child;
    },
    [qc],
  );

  return { children, patient, isLoading, select, add };
}
