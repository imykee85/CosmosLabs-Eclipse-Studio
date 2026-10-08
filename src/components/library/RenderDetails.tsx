"use client";

import { useState } from "react";
import { Check, Copy, Download, Share2, Trash2 } from "lucide-react";
import { trashRender } from "@/lib/render-actions";
import type { Render } from "@/lib/use-renders";
import "./library.css";

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}
const FORMATS: Record<string, string> = { "image/png": "PNG", "image/jpeg": "JPEG", "image/webp": "WebP" };

// The facts about one finished image, with the actions people reach for: copy the prompt, download the file, share it.
export default function RenderDetails({ g, onDeleted }: { g: Render; onDeleted?: () => void }) {
  const [copied, setCopied] = useState(false);
  const [note, setNote] = useState("");

  async function remove() {
    setNote("");
    try { await trashRender(g.id); onDeleted?.(); } catch (e) { setNote(e instanceof Error ? e.message : "Could not move this image to the bin."); }
  }

  async function copyPrompt() {
    try { await navigator.clipboard.writeText(g.prompt); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { setNote("Could not copy. Select the text and copy it by hand."); }
  }

  // Phones and some desktops can share the picture itself; otherwise a link that stops working after a week is copied.
  async function share() {
    setNote("");
    try {
      const res = await fetch(`/api/generations/${g.id}/file`);
      if (res.ok) {
        const blob = await res.blob();
        const file = new File([blob], g.fileName ?? "image.png", { type: blob.type || "image/png" });
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file], text: g.prompt });
          return;
        }
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return; // closed the share sheet
    }
    try {
      const r = await fetch(`/api/generations/${g.id}/share`, { method: "POST" });
      const data = await r.json().catch(() => ({}));
      if (!r.ok || !data.url) throw new Error();
      await navigator.clipboard.writeText(data.url);
      setNote(data.days ? `Link copied. Anyone with it can view this image for ${data.days} days.` : "Link copied.");
    } catch {
      setNote("Could not share this image. Please try again.");
    }
  }

  const rows: [string, string | null][] = [
    ["File name", g.fileName],
    ["Size", g.sizeBytes != null ? fmtBytes(g.sizeBytes) : null],
    ["Dimensions", g.width && g.height ? `${g.width} × ${g.height} px` : null],
    ["Format", g.contentType ? (FORMATS[g.contentType] ?? g.contentType) : null],
    ["Shape", g.aspectRatio],
    ["Resolution", g.resolution],
    ["Model", g.modelLabel],
    ["Created", new Date(g.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "medium" })],
  ];

  return (
    <div className="rd">
      <div className="rd-actions">
        <button type="button" className="rd-btn" onClick={copyPrompt}>{copied ? <Check size={15} /> : <Copy size={15} />}{copied ? "Copied" : "Copy prompt"}</button>
        <a className="rd-btn" href={`/api/generations/${g.id}/file?download=1`} download={g.fileName ?? undefined}><Download size={15} />Download</a>
        <button type="button" className="rd-btn" onClick={share}><Share2 size={15} />Share</button>
        <button type="button" className="rd-btn rd-danger" onClick={remove} title="Move to the bin"><Trash2 size={15} />Delete</button>
      </div>
      {note && <p className="rd-note" role="status">{note}</p>}
      <dl className="rd-list">
        {rows.filter((r): r is [string, string] => Boolean(r[1])).map(([k, v]) => (
          <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
        ))}
        <div className="rd-prompt">
          <dt>Prompt<button type="button" className="rd-icon" onClick={copyPrompt} aria-label="Copy prompt" title="Copy prompt">{copied ? <Check size={14} /> : <Copy size={14} />}</button></dt>
          <dd>{g.prompt}</dd>
        </div>
      </dl>
    </div>
  );
}
