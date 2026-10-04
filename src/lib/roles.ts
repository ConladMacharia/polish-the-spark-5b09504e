import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "therapist" | "caregiver";

/** Where each kind of person lands after login. */
export const HOME_FOR_ROLE = {
  admin: "/app/admin",
  therapist: "/app/therapist",
  caregiver: "/app/caregiver",
} as const;

/**
 * Looks up the person's role. If someone somehow has more than one,
 * the most powerful one wins (admin, then therapist, then caregiver).
 * Returns null when no role is found (treated like a caregiver).
 *
 * NOTE: this only decides which screens to show. The real protection is
 * in the database rules, which enforce who can read what.
 */
export async function fetchMyRole(userId: string): Promise<AppRole | null> {
  const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  if (error || !data) return null;
  const roles = data.map((r) => r.role);
  if (roles.includes("admin")) return "admin";
  if (roles.includes("therapist")) return "therapist";
  if (roles.includes("caregiver")) return "caregiver";
  return null;
}

export function homeForRole(role: AppRole | null) {
  return HOME_FOR_ROLE[role ?? "caregiver"];
}

/**
 * For people who signed up without a role (for example with Google): gives
 * them the role they picked on the sign-up form, or caregiver. The database
 * only ever allows caregiver or therapist here, never admin.
 */
export async function claimInitialRole(pending: string | null): Promise<AppRole | null> {
  const wanted = pending === "therapist" ? "therapist" : "caregiver";
  const { data, error } = await supabase.rpc("claim_initial_role", { _role: wanted });
  if (error || !data) return null;
  return data as AppRole;
}

export const PENDING_ROLE_KEY = "nb-pending-role";
