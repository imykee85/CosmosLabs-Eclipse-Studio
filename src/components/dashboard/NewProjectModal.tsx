"use client";

import { useRouter } from "next/navigation";
import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { saveProjectName } from "@/lib/project";

export default function NewProjectModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const card = useRef<HTMLDivElement>(null);

  // Focus the field, stop the page behind from scrolling, and restore both on close.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    input.current?.focus();
    return () => {
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, []);

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Escape") return onClose();
    if (e.key !== "Tab" || !card.current) return;
    // keep Tab inside the dialog
    const items = card.current.querySelectorAll<HTMLElement>("button:not(:disabled), input");
    const first = items[0], last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    const clean = name.trim();
    if (!clean) return;
    saveProjectName(clean);
    router.push("/project");
  }

  return (
    <div className="nm-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }} onKeyDown={onKeyDown}>
      <div ref={card} className="nm-card" role="dialog" aria-modal="true" aria-labelledby="nm-title">
        <button type="button" className="nm-close" aria-label="Close" onClick={onClose}><X size={16} /></button>
        <h2 id="nm-title">New project</h2>
        <p>Name your project to get started.</p>
        <form onSubmit={submit}>
          <label htmlFor="nm-name">PROJECT NAME</label>
          <input id="nm-name" ref={input} value={name} onChange={(e) => setName(e.target.value)} maxLength={60} autoComplete="off" placeholder="e.g. Summer Collection Launch" />
          <button type="submit" className="nm-create" disabled={!name.trim()}>Create Project</button>
        </form>
      </div>
    </div>
  );
}
