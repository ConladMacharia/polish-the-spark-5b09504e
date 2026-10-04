import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** The signed-in therapist's own row (null if there is none yet). */
export function useMyTherapist() {
  return useQuery({
    queryKey: ["therapist-me"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return null;
      const { data, error } = await supabase
        .from("therapists")
        .select("*")
        .eq("user_id", userData.user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

/** Turns the indigo therapist theme on for as long as the caller is on screen. */
export function useTherapistTheme() {
  useEffect(() => {
    document.documentElement.classList.add("theme-nb-therapist");
    return () => document.documentElement.classList.remove("theme-nb-therapist");
  }, []);
}

export function ageFromDob(dob: string | null | undefined): string | null {
  if (!dob) return null;
  const born = new Date(dob);
  if (Number.isNaN(born.getTime())) return null;
  const now = new Date();
  let months = (now.getFullYear() - born.getFullYear()) * 12 + (now.getMonth() - born.getMonth());
  if (now.getDate() < born.getDate()) months -= 1;
  if (months < 0) return null;
  if (months < 24) return `${months} mo`;
  return `${Math.floor(months / 12)} yrs`;
}
