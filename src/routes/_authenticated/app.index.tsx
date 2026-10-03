import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { fetchMyRole, homeForRole } from "@/lib/roles";

export const Route = createFileRoute("/_authenticated/app/")({
  beforeLoad: async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) throw redirect({ to: "/app/caregiver" });

    const role = await fetchMyRole(userData.user.id);
    throw redirect({ to: homeForRole(role) });
  },
});
