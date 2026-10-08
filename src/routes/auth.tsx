import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { PENDING_ROLE_KEY } from "@/lib/roles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Neuro-Bridge" },
      {
        name: "description",
        content: "Sign in or create your Neuro-Bridge account as a therapist or caregiver.",
      },
    ],
  }),
  component: AuthPage,
});

const emailSchema = z.string().trim().email({ message: "Enter a valid email" }).max(255);
const passwordSchema = z
  .string()
  .min(8, { message: "Password must be at least 8 characters" })
  .max(72);
const nameSchema = z.string().trim().min(1, { message: "Please enter your name" }).max(80);

type Role = "therapist" | "caregiver";

// Set to false to hide "Create account" (e.g. while sharing the link before a
// presentation). Also turn off sign-ups in Supabase for a real lock.
const ALLOW_SIGNUP = false;

function AuthPage() {
  const navigate = useNavigate();
  const router = useRouter();
  const [tab, setTab] = useState<"signin" | "signup">("signin");
  const [role, setRole] = useState<Role>("caregiver");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  // Email we are waiting to be confirmed (only when email confirmation is on).
  const [pendingConfirm, setPendingConfirm] = useState<string | null>(null);
  const [forgot, setForgot] = useState(false);

  // Redirect if already signed in
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/app" });
    });
  }, [navigate]);

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const parsedName = nameSchema.safeParse(fullName);
      const parsedEmail = emailSchema.safeParse(email);
      const parsedPassword = passwordSchema.safeParse(password);
      if (!parsedName.success) return toast.error(parsedName.error.issues[0].message);
      if (!parsedEmail.success) return toast.error(parsedEmail.error.issues[0].message);
      if (!parsedPassword.success) return toast.error(parsedPassword.error.issues[0].message);

      const { data, error } = await supabase.auth.signUp({
        email: parsedEmail.data,
        password: parsedPassword.data,
        options: {
          emailRedirectTo: `${window.location.origin}/app`,
          data: {
            full_name: parsedName.data,
            role,
            preferred_language: "en",
          },
        },
      });
      if (error) return toast.error(error.message);

      // An address that already has an account comes back with no identities.
      if (data.user && (data.user.identities?.length ?? 1) === 0) {
        return toast.error(
          "This email already has an account. Sign in instead, or use “Forgot password”.",
        );
      }

      // No session yet = the project asks people to confirm their email first.
      if (!data.session) {
        setPendingConfirm(parsedEmail.data);
        return;
      }

      toast.success("Account created. Welcome!");
      router.invalidate();
      navigate({ to: "/app" });
    } finally {
      setLoading(false);
    }
  }

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const parsedEmail = emailSchema.safeParse(email);
      if (!parsedEmail.success) return toast.error(parsedEmail.error.issues[0].message);
      if (!password) return toast.error("Enter your password");

      const { error } = await supabase.auth.signInWithPassword({
        email: parsedEmail.data,
        password,
      });
      if (error) {
        if (/not confirmed/i.test(error.message)) {
          setPendingConfirm(parsedEmail.data);
          return toast.error("Please confirm your email first. We can send the link again.");
        }
        if (/invalid login credentials/i.test(error.message)) {
          return toast.error(
            "Wrong email or password. If you first joined with Google, use “Forgot password” to set one.",
          );
        }
        return toast.error(error.message);
      }
      router.invalidate();
      navigate({ to: "/app" });
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (!pendingConfirm) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: pendingConfirm,
        options: { emailRedirectTo: `${window.location.origin}/app` },
      });
      if (error) return toast.error(error.message);
      toast.success("Confirmation email sent again. Check your inbox and spam folder.");
    } finally {
      setLoading(false);
    }
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const parsedEmail = emailSchema.safeParse(email);
      if (!parsedEmail.success) return toast.error(parsedEmail.error.issues[0].message);
      const { error } = await supabase.auth.resetPasswordForEmail(parsedEmail.data, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) return toast.error(error.message);
      toast.success("If that email has an account, a reset link is on its way.");
      setForgot(false);
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setLoading(true);
    try {
      // Remember which role they picked; it is applied after they come back.
      if (tab === "signup") window.localStorage.setItem(PENDING_ROLE_KEY, role);
      else window.localStorage.removeItem(PENDING_ROLE_KEY);
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        toast.error(result.error.message ?? "Google sign-in failed");
        return;
      }
      if (result.redirected) return; // browser will redirect
      router.invalidate();
      navigate({ to: "/app" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Link to="/" className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground font-display text-lg">
            N
          </span>
          <span className="font-display text-xl">Neuro-Bridge</span>
        </Link>
      </header>

      <main className="mx-auto grid max-w-md gap-6 px-6 pb-16 pt-4">
        <div className="text-center">
          <h1 className="font-display text-3xl">Welcome</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Sign in or create an account to continue.
          </p>
        </div>

        {pendingConfirm ? (
          <div className="rounded-3xl border border-border bg-card p-6 text-center shadow-sm">
            <h2 className="font-display text-2xl">Check your email</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              We sent a confirmation link to{" "}
              <span className="font-semibold text-foreground">{pendingConfirm}</span>. Open it, then
              come back and sign in. It works on any device. Look in spam if you do not see it.
            </p>
            <div className="mt-5 grid gap-2">
              <Button type="button" className="w-full" onClick={handleResend} disabled={loading}>
                Send the email again
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => {
                  setPendingConfirm(null);
                  setTab("signin");
                }}
              >
                Back to sign in
              </Button>
            </div>
          </div>
        ) : forgot ? (
          <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
            <h2 className="font-display text-2xl">Reset your password</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Enter your email and we will send a link to choose a new password. This also works if
              you first joined with Google.
            </p>
            <form onSubmit={handleForgot} className="mt-5 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="forgot-email">Email</Label>
                <Input
                  id="forgot-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Sending…" : "Send reset link"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => setForgot(false)}
              >
                Back to sign in
              </Button>
            </form>
          </div>
        ) : (
          <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
            <Tabs value={tab} onValueChange={(v) => setTab(v as "signin" | "signup")}>
              <TabsList className={`grid w-full ${ALLOW_SIGNUP ? "grid-cols-2" : "grid-cols-1"}`}>
                <TabsTrigger value="signin">Sign in</TabsTrigger>
                {ALLOW_SIGNUP && <TabsTrigger value="signup">Create account</TabsTrigger>}
              </TabsList>

              <TabsContent value="signin" className="mt-6">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="signin-email">Email</Label>
                    <Input
                      id="signin-email"
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="signin-password">Password</Label>
                    <Input
                      id="signin-password"
                      type="password"
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Signing in…" : "Sign in"}
                  </Button>
                  <button
                    type="button"
                    onClick={() => setForgot(true)}
                    className="block w-full text-center text-xs font-medium text-primary hover:underline"
                  >
                    Forgot password?
                  </button>
                </form>
              </TabsContent>

              <TabsContent value="signup" className="mt-6">
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div>
                    <Label className="mb-2 block">I am a…</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {(["caregiver", "therapist"] as Role[]).map((r) => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setRole(r)}
                          className={`rounded-2xl border p-3 text-left text-sm transition-colors ${
                            role === r
                              ? "border-primary bg-primary/5"
                              : "border-border bg-card hover:bg-accent"
                          }`}
                        >
                          <p className="font-semibold capitalize">{r}</p>
                          <p className="text-xs text-muted-foreground">
                            {r === "caregiver"
                              ? "Parent or family caring for a child"
                              : "Clinician prescribing therapy"}
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>
                  {role === "therapist" && (
                    <p className="rounded-xl bg-accent p-3 text-xs text-accent-foreground">
                      After you sign up you will add your licence number, a copy of your licence,
                      and the area you can serve. A coordinator checks these before you receive
                      requests.
                    </p>
                  )}
                  <div className="space-y-1.5">
                    <Label htmlFor="signup-name">Full name</Label>
                    <Input
                      id="signup-name"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="signup-email">Email</Label>
                    <Input
                      id="signup-email"
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="signup-password">Password</Label>
                    <Input
                      id="signup-password"
                      type="password"
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                    <p className="text-xs text-muted-foreground">At least 8 characters.</p>
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Creating account…" : "Create account"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>

            <div className="my-6 flex items-center gap-3">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs uppercase tracking-wide text-muted-foreground">or</span>
              <div className="h-px flex-1 bg-border" />
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={handleGoogle}
              disabled={loading}
            >
              <GoogleIcon />
              Continue with Google
            </Button>
            {tab === "signup" && (
              <p className="mt-3 text-center text-xs text-muted-foreground">
                With Google, you'll join as a{" "}
                <span className="font-semibold capitalize">{role}</span>. You can change this later.
              </p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" className="mr-2">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.4 29.3 35.5 24 35.5c-6.4 0-11.5-5.2-11.5-11.5S17.6 12.5 24 12.5c2.9 0 5.6 1.1 7.7 2.9l5.7-5.7C33.6 6.3 29 4.5 24 4.5 13.2 4.5 4.5 13.2 4.5 24S13.2 43.5 24 43.5 43.5 34.8 43.5 24c0-1.2-.1-2.3-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 15.5 19 12.5 24 12.5c2.9 0 5.6 1.1 7.7 2.9l5.7-5.7C33.6 6.3 29 4.5 24 4.5 16.3 4.5 9.7 8.9 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 43.5c5 0 9.5-1.7 13-4.7l-6-5c-2 1.4-4.4 2.2-7 2.2-5.3 0-9.7-3.1-11.3-7.4l-6.5 5C9.5 39 16.2 43.5 24 43.5z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4 5.5l6 5c-.4.4 6.7-4.8 6.7-14.5 0-1.2-.1-2.3-.4-3.5z"
      />
    </svg>
  );
}
