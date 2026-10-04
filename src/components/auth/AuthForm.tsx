"use client";

import { clerkEnabled } from "@/lib/clerk-enabled";
import AuthView, { type Handlers, type Mode } from "./AuthView";
import ClerkAuth from "./ClerkAuth";

const off = async () => ({ error: "Preview mode: sign-in switches on once Clerk keys are added." });
const previewHandlers: Handlers = { credentials: off, google: off, verify: off, forgot: off, reset: off };

export default function AuthForm({ mode }: { mode: Mode }) {
  return clerkEnabled ? <ClerkAuth mode={mode} /> : <AuthView mode={mode} handlers={previewHandlers} />;
}
