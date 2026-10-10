"use client";

import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, RotateCcw } from "lucide-react";
import { loadCanvasDoc, restoreCanvas, type CanvasDoc, type CanvasMeta } from "@/lib/canvas-store";
import { readCurrentProject } from "@/lib/projects";
import CanvasLibrary from "./CanvasLibrary";
import "./canvas.css";

// The canvas is heavy (graph library), so it only loads on this page.
const CanvasView = dynamic(() => import("./CanvasView"), {
  ssr: false,
  loading: () => <div className="cv-loading">Loading canvas...</div>,
});

// /canvas is the library of the open project; /canvas?c=<id> opens one canvas in the editor.
export default function CanvasPage() {
  const router = useRouter();
  const canvasId = useSearchParams().get("c");
  const [projectId, setProjectId] = useState<string | null>(null);
  useEffect(() => {
    const sync = () => setProjectId(readCurrentProject()?.id ?? "default");
    sync();
    window.addEventListener("eclipse-project-change", sync);
    return () => window.removeEventListener("eclipse-project-change", sync);
  }, []);
  if (!projectId) return <div className="cv-loading">Loading canvas...</div>;
  if (!canvasId) return <CanvasLibrary key={projectId} projectId={projectId} onOpen={(id) => router.push(`/canvas?c=${id}`)} />;
  return <Editor key={`${projectId}:${canvasId}`} projectId={projectId} canvasId={canvasId} onBack={() => router.push("/canvas")} />;
}

function Editor({ projectId, canvasId, onBack }: { projectId: string; canvasId: string; onBack: () => void }) {
  const [state, setState] = useState<{ meta: CanvasMeta; doc: CanvasDoc } | "missing" | null>(null);
  useEffect(() => {
    let live = true;
    loadCanvasDoc(projectId, canvasId).then((r) => { if (live) setState(r ?? "missing"); }).catch(() => { if (live) setState("missing"); });
    return () => { live = false; };
  }, [projectId, canvasId]);

  if (state === null) return <div className="cv-loading">Loading canvas...</div>;
  if (state === "missing") return (
    <div className="cv-loading cv-lost"><p>This canvas could not be found. It may have been deleted for good.</p><button type="button" className="cv-btn" onClick={onBack}><ArrowLeft size={14} /> Back to your canvases</button></div>
  );
  // Opened by address while it sits in Recently deleted: offer to restore it rather than silently editing a deleted canvas.
  if (state.meta.deletedAt) return (
    <div className="cv-loading cv-lost">
      <p>&ldquo;{state.meta.name}&rdquo; is in Recently deleted.</p>
      <div className="cv-lost-btns">
        <button type="button" className="cv-go" onClick={async () => { try { await restoreCanvas(projectId, canvasId); setState({ ...state, meta: { ...state.meta, deletedAt: null } }); } catch {} }}><RotateCcw size={14} /> Restore it</button>
        <button type="button" className="cv-btn" onClick={onBack}><ArrowLeft size={14} /> Back to your canvases</button>
      </div>
    </div>
  );
  return <CanvasView projectId={projectId} canvasId={canvasId} meta={state.meta} doc={state.doc} onBack={onBack} />;
}
