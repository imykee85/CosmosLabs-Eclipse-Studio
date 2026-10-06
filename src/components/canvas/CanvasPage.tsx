"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { readCurrentProject } from "@/lib/projects";
import "./canvas.css";

// The canvas is heavy (graph library), so it only loads on this page.
const CanvasView = dynamic(() => import("./CanvasView"), {
  ssr: false,
  loading: () => <div className="cv-loading">Loading canvas...</div>,
});

export default function CanvasPage() {
  const [projectId, setProjectId] = useState<string | null>(null);
  useEffect(() => {
    const sync = () => setProjectId(readCurrentProject()?.id ?? "default");
    sync();
    window.addEventListener("eclipse-project-change", sync);
    return () => window.removeEventListener("eclipse-project-change", sync);
  }, []);
  if (!projectId) return <div className="cv-loading">Loading canvas...</div>;
  return <CanvasView key={projectId} projectId={projectId} />;
}
