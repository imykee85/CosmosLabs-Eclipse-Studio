"use client";

import { SignedIn as ClerkSignedIn, SignedOut as ClerkSignedOut } from "@clerk/nextjs";
import { clerkEnabled } from "@/lib/clerk-enabled";

export function SignedIn({ children }: { children: React.ReactNode }) {
  return clerkEnabled ? <ClerkSignedIn>{children}</ClerkSignedIn> : null;
}

export function SignedOut({ children }: { children: React.ReactNode }) {
  return clerkEnabled ? <ClerkSignedOut>{children}</ClerkSignedOut> : <>{children}</>;
}
