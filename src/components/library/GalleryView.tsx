"use client";

import { useEffect, useState } from "react";
import { Image as ImageIcon } from "lucide-react";
import "./library.css";

type Render = { id: string; prompt: string; imageUrl: string };

// Your finished renders, newest first. Links are short-lived and signed, so the list is fetched fresh each visit.
export default function GalleryView() {
  const [items, setItems] = useState<Render[] | null>(null);

  useEffect(() => {
    let live = true;
    fetch("/api/generations?limit=100")
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((d) => { if (live) setItems(Array.isArray(d.items) ? d.items : []); })
      .catch(() => { if (live) setItems([]); });
    return () => { live = false; };
  }, []);

  return (
    <div className="ws-ing lib">
      <h1>Gallery</h1>
      <p>Everything you have generated, newest first.</p>
      {items && items.length > 0 ? (
        <div className="lib-grid">
          {items.map((g) => (
            // eslint-disable-next-line @next/next/no-img-element
            <a key={g.id} className="lib-tile" href={g.imageUrl} target="_blank" rel="noreferrer"><img src={g.imageUrl} alt={g.prompt} loading="lazy" /><span>{g.prompt}</span></a>
          ))}
        </div>
      ) : items ? (
        <div className="lib-empty">
          <ImageIcon size={46} strokeWidth={1.4} aria-hidden="true" />
          <h2>Nothing here yet</h2>
          <p>Images you generate while signed in appear here.</p>
        </div>
      ) : null}
    </div>
  );
}
