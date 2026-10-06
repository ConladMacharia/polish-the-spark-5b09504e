import { supabase } from "@/integrations/supabase/client";

/**
 * A caregiver can have several children. This remembers which one they are
 * working with (on this device) and finds it for every screen.
 */
const KEY = "nb-active-child";

export function getActiveChildId(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(KEY);
}

export function setActiveChildId(id: string | null) {
  if (typeof window === "undefined") return;
  if (id) window.localStorage.setItem(KEY, id);
  else window.localStorage.removeItem(KEY);
}

/** The chosen child if it still belongs to this caregiver, otherwise their first child. */
export async function fetchActiveChild(uid: string) {
  const wanted = getActiveChildId();
  if (wanted) {
    const { data } = await supabase
      .from("patients")
      .select("*")
      .eq("id", wanted)
      .eq("claimed_by_caregiver_id", uid)
      .maybeSingle();
    if (data) return data;
  }
  const { data } = await supabase
    .from("patients")
    .select("*")
    .eq("claimed_by_caregiver_id", uid)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return data;
}

export function newClaimCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

/** Accepts normal Kenyan style numbers such as 0712 345 678 or +254 712 345 678. */
export const PHONE_PATTERN = /^\+?[0-9][0-9\s-]{7,16}$/;
