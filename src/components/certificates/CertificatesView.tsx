"use client";

/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Award, Check, Copy, ExternalLink, Film, Mic, Trash2 } from "lucide-react";
import "@/components/library/library.css";
import "./certificates.css";

type Item = {
  id: string; code: string; kind: "image" | "video" | "audio"; title: string; creator: string; sha256: string; sourceType: "render" | "audio"; sourceId: string;
  showPrompt: boolean; showMedia: boolean; issuedAt: string; facts: { model?: string | null };
};

export default function CertificatesView() {
  const [items, setItems] = useState<Item[] | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");
  const [confirm, setConfirm] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/certificates");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Could not load your certificates.");
      setItems(data.certificates as Item[]); setError("");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not load your certificates."); setItems((v) => v ?? []); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function patch(c: Item, change: { showPrompt?: boolean; showMedia?: boolean }) {
    setItems((l) => l && l.map((x) => (x.id === c.id ? { ...x, ...change } : x)));
    const res = await fetch(`/api/certificates/${c.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(change) });
    if (!res.ok) { setError("Could not save that change."); load(); }
  }
  async function remove(c: Item) {
    if (confirm !== c.id) { setConfirm(c.id); return; }
    setConfirm("");
    const res = await fetch(`/api/certificates/${c.id}`, { method: "DELETE" });
    if (!res.ok) { setError("Could not withdraw the certificate."); return; }
    setItems((l) => l && l.filter((x) => x.id !== c.id));
  }
  async function copy(c: Item) {
    try { await navigator.clipboard.writeText(`${window.location.origin}/c/${c.code}`); setCopied(c.id); setTimeout(() => setCopied(""), 1800); } catch { setError("Could not copy. Open the certificate and copy its address."); }
  }

  return (
    <div className="ws-ing">
      <h1>Certificates</h1>
      <p>Timestamped records that tie each creation to you, a supporting proof of origin for your work.</p>
      {error && <p className="cf-error" role="alert">{error}</p>}
      {items === null ? <p className="cf-muted">Loading…</p>
        : items.length === 0 ? (
          <div className="lib-empty" style={{ marginTop: 0 }}>
            <Award size={42} strokeWidth={1.4} aria-hidden="true" />
            <h2>No certificates yet</h2>
            <p>Open a finished image or video in your <Link href="/library">Library</Link>, or a take in Audio Studio, and choose Certificate.</p>
          </div>
        ) : (
          <ul className="cf-list">
            {items.map((c) => (
              <li key={c.id} className="cf-card">
                <div className="cf-thumb" aria-hidden="true">
                  {c.kind === "image" ? <img src={`/api/generations/${c.sourceId}/file`} alt="" loading="lazy" />
                    : c.kind === "video" ? <Film size={26} /> : <Mic size={26} />}
                </div>
                <div className="cf-body">
                  <b translate="no">{c.title}</b>
                  <span className="cf-meta" translate="no">{c.code} · {c.facts.model ?? c.kind} · {new Date(c.issuedAt).toLocaleDateString(undefined, { dateStyle: "medium" })}</span>
                  <div className="cf-toggles">
                    <label><input type="checkbox" checked={c.showPrompt} onChange={(e) => patch(c, { showPrompt: e.target.checked })} /> Show the {c.kind === "audio" ? "script" : "prompt"} publicly</label>
                    <label><input type="checkbox" checked={c.showMedia} onChange={(e) => patch(c, { showMedia: e.target.checked })} /> Show the {c.kind === "image" ? "picture" : c.kind === "video" ? "video" : "sound"} publicly</label>
                  </div>
                </div>
                <div className="cf-actions">
                  <a className="cf-btn" href={`/c/${c.code}`} target="_blank" rel="noreferrer"><ExternalLink size={15} />Open</a>
                  <button type="button" className="cf-btn" onClick={() => copy(c)}>{copied === c.id ? <Check size={15} /> : <Copy size={15} />}{copied === c.id ? "Copied" : "Copy link"}</button>
                  <button type="button" className={`cf-btn cf-danger ${confirm === c.id ? "is-armed" : ""}`} onClick={() => remove(c)} onBlur={() => setConfirm("")}><Trash2 size={15} />{confirm === c.id ? "Tap again to withdraw" : "Withdraw"}</button>
                </div>
              </li>
            ))}
          </ul>
        )}
    </div>
  );
}
