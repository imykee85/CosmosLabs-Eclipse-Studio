"use client";

import { useAuth } from "@clerk/nextjs";
import { clerkEnabled } from "@/lib/clerk-enabled";

// Clerk's own SignedIn / SignedOut render NOTHING until its script has loaded and decided who is here, so after a log out and refresh the homepage buttons were
// missing until Clerk answered (owner 2026-10-21: "they appear after a few minutes"). Here the signed-out view shows from the first paint and is swapped for the
// signed-in view only once Clerk says a person is signed in.
function ClerkIn({ children }: { children: React.ReactNode }) {
  const { isLoaded, userId } = useAuth();
  return isLoaded && userId ? <>{children}</> : null;
}

function ClerkOut({ children }: { children: React.ReactNode }) {
  const { isLoaded, userId } = useAuth();
  return !isLoaded || !userId ? <>{children}</> : null;
}

export function SignedIn({ children }: { children: React.ReactNode }) {
  return clerkEnabled ? <ClerkIn>{children}</ClerkIn> : null;
}

export function SignedOut({ children }: { children: React.ReactNode }) {
  return clerkEnabled ? <ClerkOut>{children}</ClerkOut> : <>{children}</>;
}
