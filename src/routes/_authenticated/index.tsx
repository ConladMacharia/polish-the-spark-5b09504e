import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/")({
  beforeLoad: async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) throw redirect({ to: "/auth" });

    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id);

    const isTherapist = roles?.some((r) => r.role === "therapist");
    if (isTherapist) throw redirect({ to: "/app/therapist" });
    throw redirect({ to: "/app/caregiver" });
  },
});
