"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, X } from "lucide-react";
import type { Render } from "@/lib/use-renders";
import { uploadVideo } from "@/lib/use-uploads";
import "./timeline-editor.css";

type Studio = {
  importUrl: (url: string, name?: string) => Promise<unknown>;
  execute: (command: string, params?: Record<string, unknown>) => Promise<unknown>;
  files: () => Promise<{ path: string; size: number; kind?: string }[]> | { path: string; size: number; kind?: string }[];
  readFile: (path: string) => Promise<Uint8Array> | Uint8Array;
};
const OUT = "/exports/eclipse-edit.mp4";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** A full timeline editor (cut, trim, grade, titles, sound) that runs in the browser, in its own frame on Eclipse's address. The clip from the preview is put on the timeline; Save renders it and keeps it as a new video in the Library. */
export default function TimelineEditor({ video, projectId, onClose, onSaved }: { video: Render; projectId: string | null; onClose: () => void; onSaved: (id?: string) => void }) {
  const frame = useRef<HTMLIFrameElement | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === "Escape" && !busy) onClose(); }; window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [onClose, busy]);

  const studio = (): Studio | null => ((frame.current?.contentWindow as unknown as { filmcraft?: Studio } | null)?.filmcraft ?? null);

  // when the editor has started, the clip is put on its timeline (from our own address, so nothing leaves Eclipse)
  useEffect(() => {
    let dead = false;
    (async () => {
      for (let i = 0; i < 240 && !dead; i++) {
        const s = studio();
        if (s?.importUrl) {
          try {
            const r = (await s.importUrl(`${location.origin}/api/generations/${video.id}/file`, "clip.mp4")) as { items?: number[]; errors?: unknown[] } | undefined;
            const item = r?.items?.[0];
            if (item == null) throw new Error("not imported");
            await s.execute("file.newSequence", { fromItem: item });
            if (!dead) setReady(true);
          } catch { if (!dead) setError("The clip could not be opened in the editor."); }
          return;
        }
        await sleep(500);
      }
      if (!dead) setError("The editor did not start. Close it and try again.");
    })();
    return () => { dead = true; };
  }, [video.id]);

  async function save() {
    const s = studio(); if (!s || busy) return;
    setBusy("Rendering…"); setError("");
    try {
      await s.execute("file.exportMedia", { format: "h264", path: OUT });
      // the render runs inside the editor: wait until the file is there and has stopped growing
      let last = -1, steady = 0, size = 0;
      for (let i = 0; i < 1800 && steady < 3; i++) {
        await sleep(1000);
        const f = (await s.files()).find((x) => x.path === OUT);
        size = f?.size ?? 0;
        if (size > 0 && size === last) steady++; else steady = 0;
        last = size;
      }
      if (size <= 0) throw new Error("The render did not finish.");
      const bytes = await s.readFile(OUT);
      setBusy("Saving…");
      const file = new File([bytes as BlobPart], "edit.mp4", { type: "video/mp4" });
      const r = await uploadVideo<{ id: string }>(file, `Edit ${new Date().toISOString().slice(0, 10)}`, projectId, (f) => setBusy(`Saving ${Math.round(f * 100)}%`));
      if (!r.ok) { setError(r.error || "The edit could not be saved."); setBusy(""); return; }
      onSaved(r.item?.id); onClose();
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "The edit could not be saved."); setBusy("");
    }
  }

  return (
    <div className="te-back" role="dialog" aria-modal="true" aria-label="Video editor">
      <div className="te-bar">
        <button type="button" className="te-x" onClick={onClose} disabled={!!busy} aria-label="Close the editor"><X size={18} /></button>
        <strong>Editor</strong>
        {error && <span className="te-err" role="alert">{error}</span>}
        <button type="button" className="te-save" onClick={() => void save()} disabled={!ready || !!busy}>{busy ? <><Loader2 size={15} className="cr-spin" /> {busy}</> : "Save to Library"}</button>
      </div>
      <iframe ref={frame} className="te-frame" title="Video editor" src="/filmcraft/index.html?empty&norecover&fresh" allow="fullscreen; clipboard-write; autoplay" />
    </div>
  );
}
