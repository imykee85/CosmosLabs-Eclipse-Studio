"use client";

import { useEffect } from "react";
import { useAuth, useOrganization } from "@clerk/nextjs";
import { clerkEnabled } from "@/lib/clerk-enabled";

// Remembers which workspace (personal or a team) this browser is in. When the person switches, what this browser kept for the OTHER workspace
// (the open project, the credit balance, unsent drafts) is dropped and the page reloads, so nothing from one workspace shows in the other.
export const WORKSPACE_KEY = "eclipse-workspace";

function Watch() {
  const { isLoaded, userId, orgId } = useAuth();
  const { organization } = useOrganization();
  useEffect(() => {
    if (!isLoaded || !userId) return;
    const now = orgId ?? "personal";
    try {
      const prev = JSON.parse(localStorage.getItem(WORKSPACE_KEY) ?? "null") as { id?: string } | null;
      localStorage.setItem(WORKSPACE_KEY, JSON.stringify({ id: now, name: organization?.name ?? null }));
      if (prev?.id && prev.id !== now) {
        const drop: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && (k === "eclipse-project" || k === "eclipse-credits" || k.startsWith("eclipse-draft-"))) drop.push(k);
        }
        drop.forEach((k) => localStorage.removeItem(k));
        window.location.href = "/dashboard";
      }
    } catch {}
  }, [isLoaded, userId, orgId, organization?.name]);
  return null;
}

export default function WorkspaceWatcher() {
  return clerkEnabled ? <Watch /> : null;
}
