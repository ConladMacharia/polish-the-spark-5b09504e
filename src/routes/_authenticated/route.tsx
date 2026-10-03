import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { fetchMyRole, homeForRole } from "@/lib/roles";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return { user: null, role: null };

    const role = await fetchMyRole(data.user.id);
    const path = location.pathname;

    // Wrong-role guard: send people back to their own home screen.
    // (Hiding screens is not security — the database rules are. This is the
    // friendly layer on top.)
    if (path.startsWith("/app/admin") && role !== "admin") {
      throw redirect({ to: homeForRole(role) });
    }
    if (path.startsWith("/app/therapist") && role !== "therapist") {
      throw redirect({ to: homeForRole(role) });
    }
    if (path.startsWith("/app/caregiver") && (role === "admin" || role === "therapist")) {
      throw redirect({ to: homeForRole(role) });
    }

    return { user: data.user, role };
  },
  component: () => <Outlet />,
});
