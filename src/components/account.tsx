"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useClerk, useUser } from "@clerk/nextjs";
import { LogOut } from "lucide-react";
import type { ReactNode } from "react";
import { clerkEnabled } from "@/lib/clerk-enabled";
import { DEMO_PROFILE_EVENT, readDemoProfile, type DemoProfile } from "@/lib/demo-profile";

// Clerk hooks only run inside the keyed branch; without keys these fall back to a demo account.
type Render = (name: string, image?: string) => ReactNode;

function ClerkName({ children }: { children: Render }) {
  const { user } = useUser();
  return <>{children(user?.fullName || user?.primaryEmailAddress?.emailAddress || "Your account", user?.hasImage ? user.imageUrl : undefined)}</>;
}

// Demo account: follows edits made on the Settings page.
export function useDemoProfile(): DemoProfile {
  const [profile, setProfile] = useState<DemoProfile>({ name: "Demo User" });
  useEffect(() => {
    const sync = () => setProfile(readDemoProfile());
    sync();
    window.addEventListener(DEMO_PROFILE_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => { window.removeEventListener(DEMO_PROFILE_EVENT, sync); window.removeEventListener("storage", sync); };
  }, []);
  return profile;
}

function DemoName({ children }: { children: Render }) {
  const p = useDemoProfile();
  return <>{children(p.name, p.avatar)}</>;
}

export function AccountName({ children }: { children: Render }) {
  return clerkEnabled ? <ClerkName>{children}</ClerkName> : <DemoName>{children}</DemoName>;
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
