"use client";

import { useEffect } from "react";
import { useAuth, useOrganization } from "@clerk/nextjs";
import { clerkEnabled } from "@/lib/clerk-enabled";

// Remembers which workspace (personal or a team) this browser is in. When the person switches, what this browser kept for the OTHER workspace
// (the open project, the credit balance, unsent drafts) is dropped and the page reloads once, so nothing from one workspace shows in the other.
// Safety (2026-10-18, a reload loop after creating a team): it only acts when the workspace has stayed the same for 1.5 s (Clerk can report the old
// and the new one in turn for a moment), and it never reloads more than once a minute, whatever happens.
export const WORKSPACE_KEY = "eclipse-workspace";
const RELOADED_KEY = "eclipse-workspace-reloaded";
const SETTLE_MS = 1500;
const MIN_GAP_MS = 60_000;

function Watch() {
  const { isLoaded, userId, orgId } = useAuth();
  const { organization } = useOrganization();
  const name = organization?.name ?? null;
  useEffect(() => {
    if (!isLoaded || !userId) return;
    const now = orgId ?? "personal";
    const timer = setTimeout(() => {
      try {
        const prev = JSON.parse(localStorage.getItem(WORKSPACE_KEY) ?? "null") as { id?: string } | null;
        localStorage.setItem(WORKSPACE_KEY, JSON.stringify({ id: now, name }));
        if (!prev?.id || prev.id === now) return;
        const drop: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && (k === "eclipse-project" || k === "eclipse-credits" || k.startsWith("eclipse-draft-"))) drop.push(k);
        }
        drop.forEach((k) => localStorage.removeItem(k));
        const last = Number(sessionStorage.getItem(RELOADED_KEY) ?? 0);
        if (Date.now() - last < MIN_GAP_MS) return;
        sessionStorage.setItem(RELOADED_KEY, String(Date.now()));
        window.location.reload();
      } catch {}
    }, SETTLE_MS);
    return () => clearTimeout(timer);
  }, [isLoaded, userId, orgId, name]);
  return null;
}

export default function WorkspaceWatcher() {
  return clerkEnabled ? <Watch /> : null;
}
