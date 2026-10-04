import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { PENDING_ROLE_KEY, claimInitialRole, fetchMyRole, homeForRole } from "@/lib/roles";

export const Route = createFileRoute("/_authenticated/app/")({
  beforeLoad: async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) throw redirect({ to: "/app/caregiver" });

    let role = await fetchMyRole(userData.user.id);

    // First visit after signing up with Google: give them the role they chose.
    if (!role) {
      const pending =
        typeof window !== "undefined" ? window.localStorage.getItem(PENDING_ROLE_KEY) : null;
      role = await claimInitialRole(pending);
      if (typeof window !== "undefined") window.localStorage.removeItem(PENDING_ROLE_KEY);
    }

    throw redirect({ to: homeForRole(role) });
  },
});
