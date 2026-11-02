"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Check, ChevronLeft, Copy, Crown, Lock } from "lucide-react";
import type { PremiumCollection, PremiumItem } from "@/lib/premium";
import { allowedNow, askUpgrade, useAccess } from "@/lib/use-access";
import Tile from "./Tile";
import "../motion/motion.css";
import "./collections.css";

// One item: the picture or clip beside its prompt with a Copy button. The prompt is fetched from the server only for Growth and Scale; everyone else sees the lock.
export default function CollectionItem({ collection, item }: { collection: PremiumCollection; item: PremiumItem }) {
  const { known } = useAccess();
  const [prompt, setPrompt] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!known) return;
    if (!allowedNow("premium")) { setLocked(true); return; }
    let live = true;
    fetch(`/api/premium/${collection.slug}/${item.id}`, { cache: "no-store" })
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!live) return;
        if (r.ok && typeof d.prompt === "string") setPrompt(d.prompt);
        else if (r.status === 402) setLocked(true);
        else setError(typeof d.error === "string" ? d.error : "The prompt could not be loaded.");
      })
      .catch(() => live && setError("The prompt could not be loaded."));
    return () => { live = false; };
  }, [known, collection.slug, item.id]);

  async function copy() {
    if (!prompt) return;
    try { await navigator.clipboard.writeText(prompt); } catch {
      const ta = document.createElement("textarea"); ta.value = prompt; document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); } finally { ta.remove(); }
    }
    setCopied(true); setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="mo">
      <Link href={`/collections/${collection.slug}`} className="mo-back"><ChevronLeft size={18} /> {collection.name}</Link>
      <div className="mo-page">
        <Tile item={item} controls />
        <div className="mo-detail">
          <h1>{item.title}</h1>
          {item.model && <dl><div><dt>Model</dt><dd>{item.model}</dd></div></dl>}
          <h3>Prompt</h3>
          {locked ? (
            <div className="pc-lock">
              <Crown size={22} className="pc-crown" aria-hidden="true" />
              <p><Lock size={13} aria-hidden="true" /> The prompts are included in the Growth and Scale plans.</p>
              <button type="button" className="mo-copy" onClick={() => askUpgrade("premium")}>Upgrade</button>
            </div>
          ) : prompt ? (
            <>
              <p className="mo-prompt">{prompt}</p>
              <button type="button" className="mo-copy" onClick={copy}>{copied ? <><Check size={15} /> Copied</> : <><Copy size={15} /> Copy prompt</>}</button>
            </>
          ) : error ? <p className="mo-empty">{error}</p> : null}
        </div>
      </div>
    </div>
  );
}
