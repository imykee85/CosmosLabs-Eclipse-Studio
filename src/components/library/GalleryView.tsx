"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Image as ImageIcon, Trash2 } from "lucide-react";
import { readCurrentProject } from "@/lib/projects";
import { useRenders } from "@/lib/use-renders";
import RenderTile from "./RenderTile";
import "./library.css";

// This project's renders only, newest first (the Library shows renders from every project). Renders still being made show as tiles that fill in on their own.
export default function GalleryView() {
  const [projectId, setProjectId] = useState<string | null | undefined>(undefined);
  useEffect(() => { setProjectId(readCurrentProject()?.id ?? null); }, []);
  const { renders, reload } = useRenders(projectId === undefined ? null : projectId);
  const items = projectId === undefined ? null : renders;

  return (
    <div className="ws-ing lib">
      <h1>Gallery</h1>
      <p>Everything you have generated in this project, newest first.</p>
      {projectId && <Link className="lib-binlink" href={`/dashboard?bin=images&project=${encodeURIComponent(projectId)}`}><Trash2 size={14} /> Recently deleted</Link>}
      {items && items.length > 0 ? (
        <div className="lib-grid">
          {items.map((g) => <RenderTile key={g.id} g={g} onChanged={reload} />)}
        </div>
      ) : items ? (
        <div className="lib-empty">
          <ImageIcon size={46} strokeWidth={1.4} aria-hidden="true" />
          <h2>Nothing here yet</h2>
          <p>Images you generate in this project appear here. Renders from all projects are in the Library.</p>
        </div>
      ) : null}
    </div>
  );
}
