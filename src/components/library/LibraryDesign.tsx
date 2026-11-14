"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Box, Clapperboard, Download } from "lucide-react";
import type { Item3D } from "@/lib/design/jobs3d";
import type { MotionSummary } from "@/lib/design/motion/spec";

type Row = { kind: "3d"; at: string; item: Item3D } | { kind: "motion"; at: string; item: MotionSummary };
export const DESIGN_FILTERS = [["all", "All"], ["3d", "3D models"], ["motion", "Motions"]] as const;
export type DesignFilter = (typeof DESIGN_FILTERS)[number][0];

// Everything made in Design Studio: 3D models and motions, newest first. Opening one takes you back into the studio.
export default function LibraryDesign({ query, filter }: { query: string; filter: DesignFilter }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  useEffect(() => {
    let live = true;
    const get = (u: string) => fetch(u, { cache: "no-store" }).then((r) => (r.ok ? r.json() : { items: [] })).then((d) => (Array.isArray(d.items) ? d.items : [])).catch(() => []);
    Promise.all([get("/api/design/3d"), get("/api/design/motion")]).then(([a, b]) => {
      if (!live) return;
      const all: Row[] = [
        ...(a as Item3D[]).filter((i) => i.status === "completed").map((item): Row => ({ kind: "3d", at: item.createdAt, item })),
        ...(b as MotionSummary[]).map((item): Row => ({ kind: "motion", at: item.updatedAt, item })),
      ];
      setRows(all.sort((x, y) => y.at.localeCompare(x.at)));
    });
    return () => { live = false; };
  }, []);
  const q = query.trim().toLowerCase();
  const shown = (rows ?? []).filter((r) => (filter === "all" || r.kind === filter) && (!q || (r.kind === "3d" ? `${r.item.name} ${r.item.prompt}` : `${r.item.title} ${r.item.prompt}`).toLowerCase().includes(q)));
  return (
    <>
      {rows && !shown.length ? (
        <div className="lib-empty">
          <Box size={46} strokeWidth={1.4} aria-hidden="true" />
          <h2>No designs yet</h2>
          <p>3D models and motions you make in <Link href="/design">Design Studio</Link> appear here.</p>
        </div>
      ) : (
        <ul className="lib-audio">
          {shown.map((r) => r.kind === "3d" ? (
            <li key={`3d-${r.item.id}`}>
              <div className="lib-audio-meta"><b><Box size={14} aria-hidden="true" /> {r.item.name}</b><span>{r.item.modelLabel} · 3D model</span></div>
              <Link href={`/design?tab=3d&open=${r.item.id}`}>Open in Design Studio</Link>
              {r.item.fileUrl && <a className="lib-audio-dl" href={`${r.item.fileUrl}?download=1`} download aria-label="Download"><Download size={16} /></a>}
            </li>
          ) : (
            <li key={`m-${r.item.id}`}>
              <div className="lib-audio-meta"><b><Clapperboard size={14} aria-hidden="true" /> {r.item.title || "Motion"}</b><span>Motion · {r.item.aspect} · {r.item.versions} version{r.item.versions === 1 ? "" : "s"}</span></div>
              <Link href={`/design?tab=motion&open=${r.item.id}`}>Open in Design Studio</Link>
              <span />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
