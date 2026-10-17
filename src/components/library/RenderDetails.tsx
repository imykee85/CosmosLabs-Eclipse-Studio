"use client";

import { useState } from "react";
import { Award, Check, Copy, Download, Info, RotateCcw, Share2, Shuffle, Trash2, Volume2, Scissors } from "lucide-react";
import { getCertificate } from "@/lib/certificate-client";
import { trashRender } from "@/lib/render-actions";
import AddSoundDialog from "../voice/AddSoundDialog";
import EditVideoDialog from "../generate/EditVideoDialog";
import type { Render } from "@/lib/use-renders";
import "./library.css";

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}
const FORMATS: Record<string, string> = { "image/png": "PNG", "image/jpeg": "JPEG", "image/webp": "WebP", "video/mp4": "MP4", "video/quicktime": "MOV", "video/webm": "WebM" };

// The facts about one finished image, with the actions people reach for: copy the prompt, download the file, share it.
// With `collapsible` (Image Studio) the facts stay hidden until the "i" button in front of Copy prompt is tapped; tap it again to close them.
export default function RenderDetails({ g, onDeleted, onStarted, collapsible = false }: { g: Render; onDeleted?: () => void; onStarted?: () => void; collapsible?: boolean }) {
  const [info, setInfo] = useState(false);
  const [copied, setCopied] = useState(false);
  const [note, setNote] = useState("");
  const [cert, setCert] = useState<{ busy: boolean; code: string | null }>({ busy: false, code: null });
  const [sound, setSound] = useState(false);
  const [editing, setEditing] = useState(false);

  async function certify() {
    if (cert.code) { window.open(`/c/${cert.code}`, "_blank"); return; }
    setNote(""); setCert({ busy: true, code: null });
    try { const code = await getCertificate("render", g.id); setCert({ busy: false, code }); setNote("Certificate issued. Find it under Certificates in your avatar menu."); }
    catch (e) { setCert({ busy: false, code: null }); setNote(e instanceof Error ? e.message : "Could not issue the certificate."); }
  }

  async function remove() {
    setNote("");
    try { await trashRender(g.id); onDeleted?.(); } catch (e) { setNote(e instanceof Error ? e.message : "Could not move this to the bin."); }
  }

  const [seedCopied, setSeedCopied] = useState(false);
  async function copySeed() {
    try { await navigator.clipboard.writeText(String(g.seed)); setSeedCopied(true); setTimeout(() => setSeedCopied(false), 1800); } catch { setNote("Could not copy. Select the number and copy it by hand."); }
  }
  // Same prompt and settings again: with this image's seed (similar result), or with a new random one (a new variation).
  async function again(sameSeed: boolean) {
    setNote("");
    try {
      const video = g.kind === "video";
      // A video is started through its own route, with its own length and sound; its pictures were the start frame (first) and the end frame (second).
      const body = video
        ? { prompt: g.prompt, model: g.model, duration: g.durationSec ?? undefined, aspectRatio: g.aspectRatio ?? undefined, resolution: g.resolution ?? undefined, audio: g.hasAudio ?? undefined, projectId: g.projectId ?? undefined, start: g.references?.[0], end: g.references?.[1], ...(sameSeed ? { seed: g.seed, lockSeed: true } : {}) }
        : { prompt: g.prompt, model: g.model, aspectRatio: g.aspectRatio ?? undefined, resolution: g.resolution ?? undefined, projectId: g.projectId ?? undefined, references: g.references ?? [], ...(sameSeed ? { seed: g.seed, lockSeed: true } : {}) };
      let res = await fetch(video ? "/api/video" : "/api/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (video && res.status === 409) {
        const need = await res.clone().json().catch(() => ({}));
        if (need.needsConfirm && window.confirm(`This video costs ${need.cost} credits. Continue?`)) res = await fetch("/api/video", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, confirm: true }) });
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Could not start this render.");
      setNote(sameSeed ? `Started with the same seed. It will appear in your Gallery${g.kind === "video" ? " in a few minutes" : ""}.` : `Started a new variation. It will appear in your Gallery${g.kind === "video" ? " in a few minutes" : ""}.`);
      onStarted?.();
    } catch (e) { setNote(e instanceof Error ? e.message : "Could not start this render."); }
  }

  async function copyPrompt() {
    try { await navigator.clipboard.writeText(g.prompt); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { setNote("Could not copy. Select the text and copy it by hand."); }
  }

  // Phones and some desktops can share the picture itself; otherwise a link that stops working after a week is copied.
  async function share() {
    setNote("");
    try {
      // A video is large: it is shared as a link, never downloaded into the browser first.
      const res = g.kind === "video" ? null : await fetch(`/api/generations/${g.id}/file`);
      if (res?.ok) {
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
      setNote(data.days ? `Link copied. Anyone with it can view this ${g.kind === "video" ? "video" : "image"} for ${data.days} days.` : "Link copied.");
    } catch {
      setNote(`Could not share this ${g.kind === "video" ? "video" : "image"}. Please try again.`);
    }
  }

  const rows: [string, string | null][] = [
    ["File name", g.fileName],
    ["Size", g.sizeBytes != null ? fmtBytes(g.sizeBytes) : null],
    ["Dimensions", g.width && g.height ? `${g.width} × ${g.height} px` : null],
    ["Length", g.kind === "video" && g.durationSec ? `${Math.round(g.durationSec)} s` : null],
    ["Sound", g.kind === "video" && g.hasAudio != null ? (g.hasAudio ? "On" : "Off") : null],
    ["Format", g.contentType ? (FORMATS[g.contentType] ?? g.contentType) : null],
    ["Aspect ratio", g.aspectRatio],
    ["Resolution", g.resolution],
    ["Model", g.modelLabel],
    ["Created", new Date(g.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "medium" })],
  ];

  return (
    <div className="rd">
      <div className={`rd-actions ${collapsible ? "is-icons" : ""}`}>
        {collapsible && <button type="button" className={`rd-btn rd-info ${info ? "is-on" : ""}`} aria-expanded={info} aria-label={info ? "Hide details" : "Show details"} title="Details" onClick={() => setInfo((v) => !v)}><Info size={16} /></button>}
        <button type="button" className="rd-btn" onClick={copyPrompt} aria-label="Copy prompt" title="Copy prompt">{copied ? <Check size={15} /> : <Copy size={15} />}<span className="rd-lbl">{copied ? "Copied" : "Copy prompt"}</span></button>
        <a className="rd-btn" href={`/api/generations/${g.id}/file?download=1`} download={g.fileName ?? undefined} aria-label="Download" title="Download"><Download size={15} /><span className="rd-lbl">Download</span></a>
        <button type="button" className="rd-btn" onClick={share} aria-label="Share" title="Share"><Share2 size={15} /><span className="rd-lbl">Share</span></button>
        {g.kind === "video" && <button type="button" className="rd-btn" onClick={() => setSound(true)} aria-label="Add sound" title="Add sound to this video"><Volume2 size={15} /><span className="rd-lbl">Add sound</span></button>}
        {g.kind === "video" && <button type="button" className="rd-btn" onClick={() => setEditing(true)} aria-label="Edit video" title="Edit or extend this video"><Scissors size={15} /><span className="rd-lbl">Edit video</span></button>}
        <button type="button" className="rd-btn" onClick={certify} disabled={cert.busy} aria-label="Certificate" title="Certificate of origin"><Award size={15} /><span className="rd-lbl">{cert.busy ? "Issuing…" : cert.code ? "View certificate" : "Certificate"}</span></button>
        <button type="button" className="rd-btn rd-danger" onClick={remove} title="Move to the bin" aria-label="Delete"><Trash2 size={15} /><span className="rd-lbl">Delete</span></button>
      </div>
      {note && <p className="rd-note" role="status">{note}</p>}
      {sound && <AddSoundDialog video={g} onClose={() => setSound(false)} />}
      {editing && <EditVideoDialog video={g} onClose={() => setEditing(false)} />}
      {(!collapsible || info) && <dl className="rd-list">
        {rows.filter((r): r is [string, string] => Boolean(r[1])).map(([k, v]) => (
          <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
        ))}
        {g.seed != null && (
          <div className="rd-seed">
            <dt>Seed</dt>
            <dd>
              <span className="rd-seedline"><code>{g.seed}</code><button type="button" className="rd-icon" onClick={copySeed} aria-label="Copy seed" title="Copy seed">{seedCopied ? <Check size={14} /> : <Copy size={14} />}</button></span>
              <span className="rd-seedbtns">
                <button type="button" className="rd-btn" onClick={() => again(true)}><RotateCcw size={14} />Re-run with this seed</button>
                <button type="button" className="rd-btn" onClick={() => again(false)}><Shuffle size={14} />New variation</button>
              </span>
              <small>Similar results with the same seed, not identical.</small>
            </dd>
          </div>
        )}
        <div className="rd-prompt">
          <dt>Prompt<button type="button" className="rd-icon" onClick={copyPrompt} aria-label="Copy prompt" title="Copy prompt">{copied ? <Check size={14} /> : <Copy size={14} />}</button></dt>
          <dd>{g.prompt}</dd>
        </div>
      </dl>}
    </div>
  );
}
