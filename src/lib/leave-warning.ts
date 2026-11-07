"use client";
import { useEffect } from "react";

// While work is still on its way (an upload, an export, a reply being written), leaving the page would lose it. This asks the browser to confirm first.
// The server-side jobs (renders, audio, Core replies) keep going without the page; this guards only the work that lives in the page itself.
export function useLeaveWarning(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [active]);
}
