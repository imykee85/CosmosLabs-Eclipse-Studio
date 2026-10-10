"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { getProjectDetails, type Project, type ProjectDetails } from "@/lib/projects";

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}
const when = (iso?: string | null) => (iso ? new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : null);

export default function ProjectDetailsModal({ project, onClose }: { project: Project; onClose: () => void }) {
  const [d, setD] = useState<ProjectDetails | null>(null);
  const [error, setError] = useState("");

  // Escape closes the dialog wherever the focus is.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    let live = true;
    getProjectDetails(project.id).then((x) => { if (live) setD(x); }).catch((e) => { if (live) setError(e instanceof Error ? e.message : "Could not load the details."); });
    return () => { live = false; };
  }, [project.id]);

  const rows: [string, string | null][] = d ? [
    ["Name", d.name],
    ["Total size", fmtBytes(d.totalBytes)],
    ["Images", `${d.images.count} · ${fmtBytes(d.images.bytes)}${d.unmeasured ? ` (${d.unmeasured} older ${d.unmeasured === 1 ? "image is" : "images are"} not measured)` : ""}`],
    ["In the bin", d.binned.count ? `${d.binned.count} ${d.binned.count === 1 ? "image" : "images"} · ${fmtBytes(d.binned.bytes)}` : "Nothing"],
    ["Canvas", d.canvas ? `${d.canvas.nodes} ${d.canvas.nodes === 1 ? "node" : "nodes"} · ${fmtBytes(d.canvas.bytes)}` : "Empty"],
    ["Created", when(d.createdAt)],
    ["Last edited", when(d.updatedAt)],
    ["Project ID", d.id],
  ] : [];

  return (
    <div className="nm-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="nm-card pd-card" role="dialog" aria-modal="true" aria-labelledby="pd-title">
        <button type="button" className="nm-close" aria-label="Close" onClick={onClose}><X size={16} /></button>
        <h2 id="pd-title">Project details</h2>
        <p>{project.name}</p>
        {error ? <p className="nm-error" role="alert">{error}</p> : !d ? <p className="db-loading">Loading…</p> : (
          <dl className="pd-list">
            {rows.filter((r): r is [string, string] => Boolean(r[1])).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
          </dl>
        )}
      </div>
    </div>
  );
}
