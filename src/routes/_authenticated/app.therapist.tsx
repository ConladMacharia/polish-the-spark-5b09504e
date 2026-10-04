import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarCheck,
  ClipboardList,
  LogOut,
  Moon,
  ShieldAlert,
  Stethoscope,
  Sun,
  UserRound,
  Users,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useTheme } from "@/lib/theme";
import { useMyTherapist, useTherapistTheme } from "@/lib/therapist";
import "@/components/therapist/therapist-theme.css";

export const Route = createFileRoute("/_authenticated/app/therapist")({
  head: () => ({ meta: [{ title: "Therapist — Neuro-Bridge" }] }),
  component: TherapistLayout,
});

const NAV = [
  { to: "/app/therapist/requests", label: "Requests", icon: ClipboardList },
  { to: "/app/therapist", label: "My children", icon: Users },
  { to: "/app/therapist/visits", label: "Visits", icon: CalendarCheck },
  { to: "/app/therapist/profile", label: "Profile", icon: UserRound },
] as const;

function TherapistLayout() {
  useTherapistTheme();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { theme, toggleTheme } = useTheme();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { data: me } = useMyTherapist();

  // New requests waiting for an answer (shows as a number on the Requests tab).
  const { data: waiting } = useQuery({
    queryKey: ["therapist-waiting-count"],
    queryFn: async () => {
      const { count } = await supabase
        .from("requests")
        .select("id", { count: "exact", head: true })
        .eq("status", "matched");
      return count ?? 0;
    },
    refetchInterval: 60_000,
  });

  // First visit as a new therapist: go straight to the profile form.
  useEffect(() => {
    if (me && !me.verified && !me.profile_submitted_at && path === "/app/therapist") {
      navigate({ to: "/app/therapist/profile", replace: true });
    }
  }, [me, path, navigate]);

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  // A single patient's page keeps its own header; it just gets the theme.
  if (path.startsWith("/app/therapist/patient/")) return <Outlet />;

  const isActive = (to: string) =>
    to === "/app/therapist"
      ? path === "/app/therapist" || path === "/app/therapist/"
      : path.startsWith(to);

  return (
    <div className="min-h-screen pb-24 md:pb-8">
      <header className="sticky top-0 z-30 border-b border-border bg-card/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary font-display text-lg text-primary-foreground">
              N
            </span>
            <div className="leading-tight">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <Stethoscope className="h-3.5 w-3.5" /> Therapist
              </p>
              <p className="font-display text-base">Neuro-Bridge</p>
            </div>
          </div>

          {/* Desktop navigation */}
          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                className={`relative flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
                  isActive(to)
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-secondary hover:text-secondary-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
                {label === "Requests" && !!waiting && (
                  <span className="rounded-full bg-secondary px-1.5 text-[11px] font-bold text-secondary-foreground">
                    {waiting}
                  </span>
                )}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-1">
            <button
              onClick={toggleTheme}
              aria-label="Switch light or dark"
              className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground hover:bg-secondary"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <button
              onClick={signOut}
              aria-label="Sign out"
              className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground hover:bg-secondary"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {me && !me.verified && (
        <div className="mx-auto mt-4 max-w-6xl px-4 sm:px-6">
          <div className="flex items-start gap-3 rounded-2xl border border-border bg-secondary p-4 text-secondary-foreground">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div className="text-sm">
              {me.profile_submitted_at ? (
                <>
                  <p className="font-semibold">Your account is waiting to be verified</p>
                  <p className="mt-0.5 opacity-80">
                    A coordinator is checking your licence. Until then you can set up your own
                    patients, but requests and visits stay locked.
                  </p>
                </>
              ) : (
                <>
                  <p className="font-semibold">Finish your profile to get verified</p>
                  <p className="mt-0.5 opacity-80">
                    Add your licence and the area you work in. Requests and visits unlock once a
                    coordinator has verified you.{" "}
                    <Link
                      to="/app/therapist/profile"
                      className="font-semibold text-primary underline"
                    >
                      Open my profile
                    </Link>
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <Outlet />

      {/* Phone navigation */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 backdrop-blur md:hidden">
        <div className="mx-auto grid max-w-md grid-cols-4">
          {NAV.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className={`relative flex flex-col items-center gap-1 py-2.5 text-[11px] font-semibold ${
                isActive(to) ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <span
                className={`grid h-7 w-12 place-items-center rounded-full transition ${
                  isActive(to) ? "bg-secondary" : ""
                }`}
              >
                <Icon className="h-5 w-5" />
              </span>
              {label}
              {label === "Requests" && !!waiting && (
                <span className="absolute right-[28%] top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                  {waiting}
                </span>
              )}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
