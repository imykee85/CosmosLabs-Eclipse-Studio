"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUp, Check, Clapperboard, Copy, Layers, Loader2, Plus, Trash2, X } from "lucide-react";
import { PROMPT_ENGINES, type PromptEngine } from "@/lib/prompt-engines";
import { readCurrentProject } from "@/lib/projects";
import { PICK_LIMIT_BYTES, shrinkToFit } from "@/lib/shrink-image";
import { uploadPicture } from "@/lib/use-uploads";
import ImageStudioIcon from "../ImageStudioIcon";
import ReferencePicker, { type RefPick } from "../create/ReferencePicker";
import SoonTag from "../SoonTag";
import "./prompts.css";

// The Prompts page (VIDEO step 2): a prompt engineer. Pick an engine, add reference pictures if you have them, describe the idea, and get a production-ready
// prompt back to copy or carry on to Video Studio or Image Studio. The chat is kept in this browser, one per engine.
type Pic = { type: "upload" | "render"; id: string; label: string };
type Msg = { id: string; role: "user" | "assistant"; text: string; pics?: Pic[]; error?: boolean };

const KEY = (engine: string) => `eclipse-prompts-${engine}`;
const MAX_PICS = 4;
const uid = () => Math.random().toString(36).slice(2, 10);
const picUrl = (p: Pic) => (p.type === "upload" ? `/api/uploads/${p.id}/file` : `/api/generations/${p.id}/file`);

function load(engine: string): Msg[] {
  try { const raw = JSON.parse(localStorage.getItem(KEY(engine)) ?? "[]"); return Array.isArray(raw) ? raw.filter((m) => m && typeof m.text === "string").slice(-40) : []; } catch { return []; }
}
function save(engine: string, list: Msg[]) { try { localStorage.setItem(KEY(engine), JSON.stringify(list.slice(-40))); } catch {} }

// An answer is split into the prompts to copy (fenced code blocks; for a one-prompt engine the whole answer) and the words around them.
type Part = { kind: "prompt" | "text"; text: string };
function parts(engine: PromptEngine, text: string): Part[] {
  const fenced = [...text.matchAll(/```[a-zA-Z]*\n?([\s\S]*?)```/g)];
  if (fenced.length) {
    const out: Part[] = [];
    let at = 0;
    for (const m of fenced) {
      const before = text.slice(at, m.index).trim();
      if (before) out.push({ kind: "text", text: before });
      out.push({ kind: "prompt", text: m[1].trim() });
      at = (m.index ?? 0) + m[0].length;
    }
    const rest = text.slice(at).trim();
    if (rest) out.push({ kind: "text", text: rest });
    return out;
  }
  return [{ kind: engine.id === "kling" ? "prompt" : "text", text: text.trim() }];
}

export default function PromptsView() {
  const router = useRouter();
  const [engineId, setEngineId] = useState<PromptEngine["id"]>("kling");
  const engine = useMemo(() => PROMPT_ENGINES.find((e) => e.id === engineId)!, [engineId]);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [pics, setPics] = useState<RefPick[]>([]);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [picking, setPicking] = useState(false);
  const [note, setNote] = useState("");
  const [copied, setCopied] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => { try { const e = localStorage.getItem("eclipse-prompts-engine"); if (e && PROMPT_ENGINES.some((x) => x.id === e && x.available)) setEngineId(e as PromptEngine["id"]); } catch {} }, []);
  useEffect(() => { setMsgs(load(engineId)); setNote(""); try { localStorage.setItem("eclipse-prompts-engine", engineId); } catch {} }, [engineId]);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [msgs.length, busy]);

  const commit = (list: Msg[]) => { setMsgs(list); save(engineId, list); };

  async function send() {
    const t = text.trim();
    if (!t || busy || !engine.available) return;
    setNote("");
    const sent: Msg = { id: uid(), role: "user", text: t, pics: pics.map((p) => ({ type: p.type, id: p.id, label: p.label })) };
    const history = [...msgs, sent];
    commit(history);
    setText("");
    setPics([]);
    setBusy(true);
    try {
      const res = await fetch("/api/prompts/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ engine: engine.id, messages: history.map((m) => ({ role: m.role, text: m.text })), images: sent.pics?.map((p) => ({ type: p.type, id: p.id })) }) });
      const data = await res.json().catch(() => ({}));
      commit([...history, res.ok ? { id: uid(), role: "assistant", text: String(data.text ?? "") } : { id: uid(), role: "assistant", text: typeof data.error === "string" ? data.error : "The prompt engine couldn't answer. Please try again.", error: true }]);
    } catch {
      commit([...history, { id: uid(), role: "assistant", text: "I couldn't reach the server. Check your connection and try again.", error: true }]);
    } finally { setBusy(false); }
  }

  async function uploadFromDevice(f: File | undefined) {
    if (!f) return;
    setNote("");
    if (!["image/png", "image/jpeg", "image/webp"].includes(f.type)) { setNote("Only PNG, JPEG and WebP pictures can be added."); return; }
    if (f.size > PICK_LIMIT_BYTES) { setNote("That picture is larger than 50 MB. Please use a smaller one."); return; }
    if (pics.length >= MAX_PICS) { setNote(`You can add up to ${MAX_PICS} pictures.`); return; }
    setUploading(true);
    try {
      const fitted = await shrinkToFit(f);
      if (!fitted) { setNote("Could not make that picture small enough. Please try another."); return; }
      const r = await uploadPicture(fitted, "asset", f.name.replace(/\.[^.]+$/, "").slice(0, 80) || "Picture", readCurrentProject()?.id ?? null);
      if (!r.ok) { setNote(r.error); return; }
      if (r.item) setPics((l) => [...l, { type: "upload" as const, id: r.item!.id, url: r.item!.imageUrl, label: r.item!.name }].slice(0, MAX_PICS));
    } finally { setUploading(false); }
  }

  function copy(id: string, value: string) {
    void navigator.clipboard?.writeText(value).then(() => { setCopied(id); window.setTimeout(() => setCopied(""), 1400); }).catch(() => {});
  }
  const carry = (value: string) => router.push(`${engine.forModel === "video" ? "/generate" : "/create"}?prompt=${encodeURIComponent(value.slice(0, 4000))}`);
  const clear = () => { commit([]); setNote(""); };

  return (
    <div className="pm-wrap">
      <header className="pm-head">
        <h1 className="pg-title">Prompts</h1>
        <p>Describe the idea, add reference pictures if you have them, and get a production-ready prompt back.</p>
      </header>

      <div className="pm-engines" role="tablist" aria-label="Prompt engine">
        {PROMPT_ENGINES.map((e) => (
          <button key={e.id} type="button" role="tab" aria-selected={e.id === engineId} className={`pm-engine ${e.id === engineId ? "is-on" : ""}`} onClick={() => (e.available ? setEngineId(e.id) : setNote(`${e.name} is coming soon.`))}>
            {e.forModel === "video" ? <Clapperboard size={14} /> : <ImageStudioIcon size={14} />} {e.name} {!e.available && <SoonTag />}
          </button>
        ))}
      </div>
      <p className="pm-blurb">{engine.blurb}</p>

      <section className="pm-thread" aria-label="Conversation" aria-live="polite">
        {msgs.length === 0 && <p className="pm-empty">{engine.forModel === "video" ? "Try: a selfie video of someone showing a new skincare product, with a short line of dialogue." : "Try: a product photo of a perfume bottle on wet stone, soft window light, with the label kept exactly as in my picture."}</p>}
        {msgs.map((m) => (
          <div key={m.id} className={`pm-msg is-${m.role} ${m.error ? "is-error" : ""}`}>
            {m.role === "user" ? (
              <>
                {m.pics && m.pics.length > 0 && (
                  <div className="pm-pics">
                    {m.pics.map((p, i) => (
                      <span key={`${p.id}-${i}`}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={picUrl(p)} alt={p.label} title={p.label} />
                      </span>
                    ))}
                  </div>
                )}
                <p>{m.text}</p>
              </>
            ) : m.error ? <p>{m.text}</p> : (
              parts(engine, m.text).map((part, i) => part.kind === "prompt" ? (
                <div key={i} className="pm-block">
                  <pre>{part.text}</pre>
                  <div className="pm-block-acts">
                    <button type="button" onClick={() => copy(`${m.id}-${i}`, part.text)}>{copied === `${m.id}-${i}` ? <Check size={14} /> : <Copy size={14} />} {copied === `${m.id}-${i}` ? "Copied" : "Copy"}</button>
                    <button type="button" onClick={() => carry(part.text)}>{engine.forModel === "video" ? <Clapperboard size={14} /> : <ImageStudioIcon size={14} />} Use in {engine.forModel === "video" ? "Video Studio" : "Image Studio"}</button>
                  </div>
                </div>
              ) : <p key={i} className="pm-say">{part.text}</p>)
            )}
          </div>
        ))}
        {busy && <div className="pm-msg is-assistant"><p className="pm-typing"><Loader2 size={14} className="cr-spin" /> Writing your prompt…</p></div>}
        <div ref={end} />
      </section>

      <div className="pm-dock">
        {note && <p className="pm-note" role="status">{note}</p>}
        <form className="pm-box" onSubmit={(e) => { e.preventDefault(); void send(); }}>
          {pics.length > 0 && (
            <div className="pm-attached" aria-label="Reference pictures">
              {pics.map((p, i) => (
                <span key={`${p.type}-${p.id}`} className="pm-att" title={`Image ${i + 1}: ${p.label}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={picUrl(p)} alt={p.label} /><i>{i + 1}</i>
                  <button type="button" aria-label={`Remove ${p.label}`} onClick={() => setPics((l) => l.filter((x) => !(x.type === p.type && x.id === p.id)))}><X size={12} /></button>
                </span>
              ))}
            </div>
          )}
          <textarea rows={2} value={text} maxLength={6000} aria-label="Describe your idea" placeholder={engine.forModel === "video" ? "Describe the video you want…" : "Describe the image you want…"}
            onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void send(); } }} />
          <div className="pm-tools">
            <button type="button" className="pm-tool" aria-label="Upload a picture from your device" title="Upload a picture from your device" disabled={uploading || pics.length >= MAX_PICS} onClick={() => fileInput.current?.click()}>{uploading ? <Loader2 size={15} className="cr-spin" /> : <Plus size={16} />}</button>
            <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => { void uploadFromDevice(e.target.files?.[0]); e.target.value = ""; }} />
            <button type="button" className="pm-tool pm-wide" onClick={() => setPicking(true)} title="Choose pictures you already have"><Layers size={14} /> Ingredients{pics.length ? ` (${pics.length})` : ""}</button>
            {msgs.length > 0 && <button type="button" className="pm-tool" aria-label="Clear the conversation" title="Clear the conversation" onClick={clear}><Trash2 size={15} /></button>}
            <button type="submit" className="pm-send" disabled={!text.trim() || busy} aria-label="Send">{busy ? <Loader2 size={16} className="cr-spin" /> : <ArrowUp size={18} />}</button>
          </div>
        </form>
      </div>
      {picking && <ReferencePicker max={MAX_PICS} picked={pics} onChange={setPics} onClose={() => setPicking(false)} />}
    </div>
  );
}
