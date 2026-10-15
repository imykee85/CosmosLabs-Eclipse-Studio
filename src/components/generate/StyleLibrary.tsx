"use client";

import { useEffect, useState } from "react";
import { Search, X } from "lucide-react";
import SoonTag from "../SoonTag";

// The Style template library for Genjutsu: named looks that redraw your own video while keeping its movement. The window and its search are built;
// the templates themselves are NOT connected yet (the list of looks and the request that applies one are not in our API reference), so it says so.
export default function StyleLibrary({ onClose }: { onClose: () => void }) {
  const [q, setQ] = useState("");
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="rd-scrim" onClick={onClose}>
      <div className="up-dialog rp-dialog" role="dialog" aria-modal="true" aria-label="Style templates" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="rd-close" onClick={onClose} aria-label="Close"><X size={18} /></button>
        <h2>Style templates <SoonTag /></h2>
        <p className="rp-note">Pick a look and your video is redrawn in it, keeping its movement.</p>
        <label className="vs-style-search"><Search size={15} /><input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search styles" aria-label="Search styles" /></label>
        <p className="rp-note" role="status">{q.trim() ? `No style matches "${q.trim()}".` : "Style templates aren't connected yet. They will appear here."}</p>
      </div>
    </div>
  );
}
