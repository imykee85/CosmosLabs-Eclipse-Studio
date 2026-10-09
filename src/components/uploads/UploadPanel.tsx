"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { readCurrentProject } from "@/lib/projects";
import { deleteUpload, uploadPicture, useUploads, type UploadRow } from "@/lib/use-uploads";
import type { UploadKind } from "@/lib/uploads";
import "@/components/library/library.css";
import "./uploads.css";

const LABEL: Record<UploadKind, string> = { asset: "Asset", character: "Character", product: "Product", scene: "Scene" };
const MAX_BYTES = 4 * 1024 * 1024;
const size = (n: number) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

type Props = {
  /** Which uploads to list: one kind, or "ingredients" (character + product + scene). */
  show: UploadKind | "ingredients";
  /** The kinds the Add dialog offers; one entry means the kind is fixed. */
  addKinds: UploadKind[];
  /** Open the Add dialog at once with this kind (used by the Ingredients cards). */
  openWith?: UploadKind | null;
  onOpened?: () => void;
  addLabel: string;
  empty: { title: string; copy: string };
  readOnly?: boolean;
  role?: UploadKind | "all";
};

// A grid of the user's uploaded pictures with an Add dialog (name + picture). Used by Ingredients, Assets and the Library.
export default function UploadPanel({ show, addKinds, openWith, onOpened, addLabel, empty, readOnly, role = "all" }: Props) {
  const { items, error, reload } = useUploads(show);
  const [dialogKind, setDialogKind] = useState<UploadKind | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => { if (openWith) { setDialogKind(openWith); onOpened?.(); } }, [openWith, onOpened]);

  const rows = (items ?? []).filter((u) => role === "all" || u.kind === role);

  async function remove(u: UploadRow) {
    if (!window.confirm(`Delete “${u.name}” for good? This cannot be undone.`)) return;
    setBusyId(u.id);
    const ok = await deleteUpload(u.id);
    setBusyId(null);
    if (ok) void reload(); else window.alert("Could not delete that picture. Please try again.");
  }

  return (
    <div className="up">
      {!readOnly && <button type="button" className="ws-add up-add" onClick={() => setDialogKind(addKinds[0])}><Plus size={16} /> {addLabel}</button>}
      {error && <p className="up-error" role="alert">{error}</p>}
      {items && rows.length === 0 && !error && (
        <section className="ws-ing-empty"><h2>{empty.title}</h2><p>{empty.copy}</p></section>
      )}
      {rows.length > 0 && (
        <div className="up-grid">
          {rows.map((u) => (
            <figure key={u.id} className="up-tile">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={u.imageUrl} alt={u.name} loading="lazy" />
              <figcaption><strong>{u.name}</strong><span>{[LABEL[u.kind], u.width && u.height ? `${u.width}×${u.height}` : null, size(u.sizeBytes)].filter(Boolean).join(" · ")}</span></figcaption>
              {!readOnly && <button type="button" className="up-del" disabled={busyId === u.id} onClick={() => remove(u)} aria-label={`Delete ${u.name}`}><Trash2 size={15} /></button>}
            </figure>
          ))}
        </div>
      )}
      {dialogKind && <AddDialog kinds={addKinds} initial={dialogKind} onClose={() => setDialogKind(null)} onDone={() => { setDialogKind(null); void reload(); }} />}
    </div>
  );
}

function AddDialog({ kinds, initial, onClose, onDone }: { kinds: UploadKind[]; initial: UploadKind; onClose: () => void; onDone: () => void }) {
  const [kind, setKind] = useState<UploadKind>(initial);
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !busy) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, busy]);
  useEffect(() => {
    if (!file) { setPreview(null); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function pick(f: File | undefined) {
    setErr(null);
    if (!f) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(f.type)) { setErr("Only PNG, JPEG and WebP pictures can be uploaded."); return; }
    if (f.size > MAX_BYTES) { setErr("That picture is larger than 4 MB. Please use a smaller one."); return; }
    setFile(f);
    if (!name.trim()) setName(f.name.replace(/\.[^.]+$/, "").slice(0, 80));
  }

  async function submit() {
    if (!file || busy) return;
    setBusy(true); setErr(null);
    const r = await uploadPicture(file, kind, name.trim(), readCurrentProject()?.id ?? null);
    setBusy(false);
    if (r.ok) onDone(); else setErr(r.error);
  }

  return (
    <div className="rd-scrim" onClick={() => !busy && onClose()}>
      <div className="up-dialog" role="dialog" aria-modal="true" aria-label={`Add ${LABEL[kind].toLowerCase()}`} onClick={(e) => e.stopPropagation()}>
        <button type="button" className="rd-close" onClick={onClose} disabled={busy} aria-label="Close"><X size={18} /></button>
        <h2>Add {kinds.length > 1 ? "an ingredient" : "a picture"}</h2>
        {kinds.length > 1 && (
          <div className="lib-roles" role="group" aria-label="Type">
            {kinds.map((k) => <button key={k} type="button" aria-pressed={kind === k} className={kind === k ? "is-active" : ""} onClick={() => setKind(k)}>{LABEL[k]}</button>)}
          </div>
        )}
        <button type="button" className="up-drop" onClick={() => input.current?.click()}>
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="Chosen picture" />
          ) : <span>Choose a picture<small>PNG, JPEG or WebP, up to 4 MB</small></span>}
        </button>
        <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
        <label className="up-field">
          <span>Name</span>
          <input value={name} maxLength={80} onChange={(e) => setName(e.target.value)} placeholder={`e.g. ${kind === "product" ? "Blue bottle" : kind === "character" ? "Maya" : kind === "scene" ? "Rooftop at dusk" : "Front view"}`} />
        </label>
        {err && <p className="up-error" role="alert">{err}</p>}
        <button type="button" className="ws-add" disabled={!file || busy} onClick={submit}>{busy ? "Uploading…" : "Upload"}</button>
      </div>
    </div>
  );
}
