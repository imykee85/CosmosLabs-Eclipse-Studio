"use client";

import { useRouter } from "next/navigation";
import { clerkEnabled } from "@/lib/clerk-enabled";
import AuthView, { type Handlers, type Mode } from "./AuthView";
import ClerkAuth from "./ClerkAuth";

// Demo mode exists ONLY when Clerk keys are missing (no real auth to bypass). With keys set,
// this branch is never rendered and the real Clerk flow is used.
export const DEMO_LOGIN = { email: "demo@eclipse.test", password: "demo1234" };

function DemoAuth({ mode }: { mode: Mode }) {
  const router = useRouter();
  const unavailable = async () => ({ error: "Not available in demo mode." });

  const handlers: Handlers = {
    async credentials(email, password) {
      if (mode === "signup") {
        if (password.length < 8) return { error: "Use a password of at least 8 characters." };
        router.push("/onboarding");
        return;
      }
      if (email.trim().toLowerCase() === DEMO_LOGIN.email && password === DEMO_LOGIN.password) {
        router.push("/create");
        return;
      }
      return { error: `Demo mode: sign in with ${DEMO_LOGIN.email} / ${DEMO_LOGIN.password}, or create an account.` };
    },
    google: async () => ({ error: "Google sign-in is not available in demo mode." }),
    verify: unavailable,
    forgot: unavailable,
    reset: unavailable,
  };

  return <AuthView mode={mode} handlers={handlers} demo={DEMO_LOGIN} />;
}

export default function AuthForm({ mode }: { mode: Mode }) {
  return clerkEnabled ? <ClerkAuth mode={mode} /> : <DemoAuth mode={mode} />;
}
