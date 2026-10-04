"use client";

import { useRouter } from "next/navigation";
import { useClerk, useUser } from "@clerk/nextjs";
import { LogOut } from "lucide-react";
import type { ReactNode } from "react";
import { clerkEnabled } from "@/lib/clerk-enabled";

// Clerk hooks only run inside the keyed branch; without keys these fall back to a demo account.
function ClerkName({ children }: { children: (name: string) => ReactNode }) {
  const { user } = useUser();
  return <>{children(user?.fullName || user?.primaryEmailAddress?.emailAddress || "Your account")}</>;
}

export function AccountName({ children }: { children: (name: string) => ReactNode }) {
  return clerkEnabled ? <ClerkName>{children}</ClerkName> : <>{children("Demo User")}</>;
}

function ClerkSignOut({ className }: { className?: string }) {
  const { signOut } = useClerk();
  return (
    <button className={className} aria-label="Sign out" onClick={() => signOut({ redirectUrl: "/" })}>
      <LogOut size={16} />
    </button>
  );
}

function DemoSignOut({ className }: { className?: string }) {
  const router = useRouter();
  return (
    <button className={className} aria-label="Sign out" onClick={() => router.push("/")}>
      <LogOut size={16} />
    </button>
  );
}

export function SignOutButton({ className }: { className?: string }) {
  return clerkEnabled ? <ClerkSignOut className={className} /> : <DemoSignOut className={className} />;
}
