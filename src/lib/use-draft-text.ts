"use client";

import { useEffect, useRef, useState } from "react";
import { readDraft, writeDraft } from "@/lib/draft";

// A message box whose text survives a refresh (same storage and sign-out clearing as the studios' drafts). Sending clears the box, which clears the draft.
export function useDraftText(screen: string, max = 8000) {
  const [text, setText] = useState("");
  const ready = useRef(false);
  useEffect(() => {
    const saved = readDraft<{ text: string }>(screen)?.text;
    if (typeof saved === "string" && saved) setText((t) => t || saved.slice(0, max));
    ready.current = true;
  }, [screen, max]);
  useEffect(() => { if (ready.current) writeDraft(screen, { text }); }, [screen, text]);
  return [text, setText] as const;
}
