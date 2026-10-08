"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { renameProject, type Project } from "@/lib/projects";

export default function RenameProjectModal({ project, onClose, onDone }: { project: Project; onClose: () => void; onDone: () => void }) {
  const [name, setName] = useState(project.name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);

  // Escape closes the dialog wherever the focus is.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => { input.current?.focus(); input.current?.select(); }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const clean = name.trim();
    if (!clean || busy) return;
    if (clean === project.name) return onClose();
    setBusy(true);
    setError("");
    try {
      await renameProject(project.id, clean);
      onDone();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not rename the project.");
      setBusy(false);
    }
  }

  return (
    <div className="nm-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="nm-card" role="dialog" aria-modal="true" aria-labelledby="rn-title">
        <button type="button" className="nm-close" aria-label="Close" onClick={onClose}><X size={16} /></button>
        <h2 id="rn-title">Rename project</h2>
        <p>Choose a new name. Your work stays exactly as it is.</p>
        <form onSubmit={submit}>
          <label htmlFor="rn-name">PROJECT NAME</label>
          <input id="rn-name" ref={input} value={name} onChange={(e) => setName(e.target.value)} maxLength={60} autoComplete="off" />
          {error && <p className="nm-error" role="alert">{error}</p>}
          <button type="submit" className="nm-create" disabled={!name.trim() || busy}>{busy ? "Saving…" : "Save name"}</button>
        </form>
      </div>
    </div>
  );
}
