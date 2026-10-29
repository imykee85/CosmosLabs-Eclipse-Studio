"use client";

import { useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import { clerkEnabled } from "@/lib/clerk-enabled";
import { flushSync, installSync, pullSync, stopSync } from "@/lib/chat-sync";

// Saves the Atlas, Prompts and Treatment chats to the person's account (see `src/lib/chat-sync.ts`). Signed-in only; nothing runs in preview mode.
function Sync() {
  const { isLoaded, userId } = useAuth();
  useEffect(() => {
    if (!isLoaded) return;
    if (!userId) { stopSync(); return; }
    installSync();
    void pullSync();
    let last = Date.now();
    const onVisible = () => {
      if (document.visibilityState === "hidden") flushSync();
      else if (Date.now() - last > 60_000) { last = Date.now(); void pullSync(); }
    };
    const onHide = () => flushSync();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pagehide", onHide);
    window.addEventListener("focus", onVisible);
    return () => { document.removeEventListener("visibilitychange", onVisible); window.removeEventListener("pagehide", onHide); window.removeEventListener("focus", onVisible); };
  }, [isLoaded, userId]);
  return null;
}

export default function ChatSync() {
  return clerkEnabled ? <Sync /> : null;
}
