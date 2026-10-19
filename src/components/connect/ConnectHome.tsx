"use client";

import GrowArea from "@/components/GrowArea";
import Link from "next/link";
import { KeyboardEvent, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowUp, Brain, Clock, Layers, Loader2, Mic, Plus, Puzzle, SquarePen, Wrench, X } from "lucide-react";
import AgentIcon from "../AgentIcon";
import AgentMenu from "../create/AgentMenu";
import AgentWidget from "../create/AgentWidget";
import { MODEL_KEY } from "@/lib/connect-models";
import { useDraftText } from "@/lib/use-draft-text";
import { useAgent } from "@/lib/use-agent";
import { useAgentHost } from "@/lib/agent-chat";
import { readCurrentProject } from "@/lib/projects";
import { useDictation } from "@/lib/use-dictation";
import { uploadPicture } from "@/lib/use-uploads";
import { PICK_LIMIT_BYTES, shrinkToFit } from "@/lib/shrink-image";
import ReferencePicker, { type RefPick } from "../create/ReferencePicker";
import BrandLogo from "./brands";
import ChatThread, { type Line } from "./ChatThread";
import ModelPicker from "./ModelPicker";
import "@/components/create/create.css"; // the Atlas widget and its menu are styled there (Treatment does the same)
import "./connect.css";
import { refreshCredits } from "@/lib/use-credits";


// Pictures go to the assistant as ids: a finished render's id, or "up:<id>" for a picture added from the device.
const imageIds = (list: RefPick[]) => list.map((p) => (p.type === "upload" ? `up:${p.id}` : p.id));

// Connect: the assistant. Chat with it, let it use skills, tools, memory and your connected apps, and send finished content on.
function ConnectChat() {
  const router = useRouter();
  const params = useSearchParams();
  const [text, setText] = useDraftText("core");
  // Atlas: the same shared agent choice and switch as every other prompt box; switched on, the floating Atlas appears and its card is the chat.
  const agent = useAgent();
  const [agentAnchor, setAgentAnchor] = useState<DOMRect | null>(null);
  const agentChip = useRef<HTMLButtonElement>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [chatId, setChatId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const mic = useDictation(text, setText, setNotice);
  const stopMic = mic.stop;
  // Pictures riding with the next message: from the device (the +, saved to Assets) or the Library (the Ingredients chip), up to 3.
  const [picked, setPicked] = useState<RefPick[]>([]);
  const [picking, setPicking] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const end = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  const started = useRef(false);

  // Open an earlier chat from the link (?chat=), or send a message handed over by Skills or Tools (?start=), once.
  const open = useCallback(async (id: string) => {
    setNotice("");
    const res = await fetch(`/api/connect/chats/${id}`, { cache: "no-store" });
    if (!res.ok) { setNotice(res.status === 503 ? "Sign in to use the assistant." : "That chat could not be opened."); return; }
    const data = await res.json();
    setChatId(data.id);
    setLines(data.lines);
  }, []);

  const send = useCallback(async (message: string, images: string[] = []) => {
    const clean = message.trim();
    if (!clean || busy) return;
    setBusy(true);
    setNotice("");
    setText("");
    setPicked([]);
    stopMic();
    setLines((l) => [...l, { role: "user", parts: [{ kind: "text", text: images.length ? `${clean}\n(${images.length} picture${images.length > 1 ? "s" : ""} attached)` : clean }] }, { role: "assistant", parts: [] }]);
    const patch = (fn: (a: Line) => Line) => setLines((l) => { const c = [...l]; c[c.length - 1] = fn(c[c.length - 1]); return c; });
    try {
      let model = "auto";
      try { model = localStorage.getItem(MODEL_KEY) ?? "auto"; } catch {}
      const res = await fetch("/api/connect/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: clean, chatId, model, images, projectId: readCurrentProject()?.id }),
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        patch((a) => ({ ...a, error: data.error ?? "Something went wrong. Please try again." }));
        return;
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const raw = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (!raw) continue;
          let e: { t: string; id?: string; d?: string; name?: string; message?: string };
          try { e = JSON.parse(raw); } catch { continue; }
          if (e.t === "chat" && e.id) { setChatId(e.id); window.history.replaceState(null, "", `/connect?chat=${e.id}`); }
          else if (e.t === "text" && e.d) patch((a) => {
            const parts = [...a.parts]; const last = parts[parts.length - 1];
            if (last?.kind === "text") parts[parts.length - 1] = { kind: "text", text: last.text + e.d };
            else parts.push({ kind: "text", text: e.d! });
            return { ...a, parts };
          });
          else if (e.t === "tool" && e.name) patch((a) => ({ ...a, parts: [...a.parts, { kind: "tool", name: e.name! }] }));
          else if (e.t === "render" && e.id) patch((a) => ({ ...a, parts: [...a.parts, { kind: "render", id: e.id! }] }));
          else if (e.t === "error") patch((a) => ({ ...a, error: e.message }));
        }
      }
    } catch {
      patch((a) => ({ ...a, error: "The connection dropped. Reload this chat to see what was saved." }));
    } finally {
      setBusy(false);
      refreshCredits();
    }
  }, [busy, chatId, setText, stopMic]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const c = params.get("chat");
    const s = params.get("start");
    const attach = (params.get("attach") ?? "").split(",").filter((x) => /^[\w-]{1,64}$/.test(x)).slice(0, 3); // pictures picked on the Tools page
    if (c) open(c);
    else if (s) { router.replace("/connect"); send(s, attach); }
  }, [params, open, router, send]);

  // Atlas can fill the message box ("Use this prompt") and, when you press Generate on its card, send that message to the Core chat.
  useAgentHost({ page: "core", context: () => ({ prompt: text, message: notice || undefined, pictures: picked.map((p) => ({ type: p.type, id: p.id, role: p.type === "upload" ? "added from the device" : "attached from the Library" })) }), setPrompt: setText, generate: async (o) => { const t = (o.prompt ?? text).trim(); if (!t) return "Write or ask for something first."; void send(t, []); return ""; } });
  const scrollEnd = useCallback(() => { end.current?.scrollIntoView({ block: "end", behavior: "smooth" }); }, []);
  useEffect(() => { scrollEnd(); }, [lines, scrollEnd]);

  function fresh() {
    setChatId(null); setLines([]); setNotice(""); setPicked([]);
    window.history.replaceState(null, "", "/connect");
  }
  function onKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    // Enter makes a new line (owner 2026-10-19); Ctrl or Cmd + Enter sends, like the other prompt boxes.
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); send(text, imageIds(picked)); }
  }
  async function uploadFromDevice(f: File | undefined) {
    if (!f) return;
    setNotice("");
    if (!["image/png", "image/jpeg", "image/webp"].includes(f.type)) { setNotice("Only PNG, JPEG and WebP pictures can be added."); return; }
    if (f.size > PICK_LIMIT_BYTES) { setNotice("That picture is larger than 50 MB. Please use a smaller one."); return; }
    if (picked.length >= 3) { setNotice("You can add up to 3 pictures."); return; }
    setUploading(true);
    try {
      const fitted = await shrinkToFit(f);
      if (!fitted) { setNotice("Could not make that picture small enough. Please try another."); return; }
      const r = await uploadPicture(fitted, "asset", f.name.replace(/\.[^.]+$/, "").slice(0, 80) || "Picture", readCurrentProject()?.id ?? null);
      if (!r.ok) { setNotice(r.error); return; }
      if (r.item) setPicked((l) => [...l, { type: "upload" as const, id: r.item!.id, url: r.item!.imageUrl, label: r.item!.name }].slice(0, 3));
    } finally { setUploading(false); }
  }
  const chatting = lines.length > 0;

  return (
    <div className={`cn-wrap cn-chat ${chatting ? "is-chatting" : ""}`}>
      <div className="cn-corner">
        <Link href="/connect/history" className="cn-corner-btn" aria-label="History" title="History"><Clock size={18} /></Link>
        <button type="button" className="cn-corner-btn" onClick={fresh} aria-label="New chat" title="New chat"><SquarePen size={18} /></button>
      </div>

      {chatting ? (
        <>
          <ChatThread lines={lines} busy={busy} grew={scrollEnd} />
        </>
      ) : (
        <div className="cn-hero">
          <div className="cn-dests" aria-hidden="true">
            {["tiktok", "instagram", "telegram", "slack", "youtube"].map((b) => <BrandLogo key={b} brand={b} size={48} />)}
          </div>
          <h1>Your creative computer</h1>
          <p>Ask for anything, run skills and tools, keep a memory of your work, and send it to your apps.</p>
        </div>
      )}

      <div className="cn-dock">
        <div className="cn-chips">
          <Link href="/skills" className="cn-chip"><Puzzle size={15} /> Skills</Link>
          <Link href="/tools" className="cn-chip"><Wrench size={15} /> Tools</Link>
          <Link href="/memory" className="cn-chip"><Brain size={15} /> Memory</Link>
          <Link href="/connect/apps" className="cn-chip">
            <span className="cn-stack" aria-hidden="true">{["tiktok", "telegram", "youtube"].map((b) => <BrandLogo key={b} brand={b} size={24} />)}</span> Connectors
          </Link>
        </div>

        <form className="cn-box" onSubmit={(e) => { e.preventDefault(); send(text, imageIds(picked)); }}>
          {picked.length > 0 && (
            <div className="cn-picked">
              {picked.map((p) => (
                <span key={`${p.type}-${p.id}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.type === "upload" ? `/api/uploads/${p.id}/file` : `/api/generations/${p.id}/file`} alt={p.label} />
                  <button type="button" aria-label="Remove picture" onClick={() => setPicked((l) => l.filter((x) => !(x.type === p.type && x.id === p.id)))}><X size={12} /></button>
                </span>
              ))}
            </div>
          )}
          <GrowArea ref={box} rows={2} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={onKey} aria-label="Message box" maxLength={8000}
            placeholder={chatting ? "Reply…" : "Ask for an image, run a skill, or send something to an app..."} />
          {notice && <p className="cn-err" role="alert">{notice}</p>}
          <div className="cn-tools">
            <button type="button" className="cn-round" aria-label="Upload a picture from your device" title="Upload a picture from your device" disabled={uploading || picked.length >= 3} onClick={() => fileInput.current?.click()}>{uploading ? <Loader2 size={16} className="cr-spin" /> : <Plus size={18} />}</button>
            <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => { void uploadFromDevice(e.target.files?.[0]); e.target.value = ""; }} />
            <button type="button" className="cr-chip" title="Choose pictures from your Library" onClick={() => setPicking(true)}><Layers size={14} /> <span className="cr-aname">Ingredients{picked.length ? ` (${picked.length})` : ""}</span></button>
            <button type="button" className={`cn-round ${mic.listening ? "is-live" : ""}`} aria-label={mic.listening ? "Stop voice input" : "Voice input"} title={mic.listening ? "Stop" : "Talk instead of typing"} aria-pressed={mic.listening} onClick={mic.toggle}><Mic size={17} /></button>
            <ModelPicker />
            <div className="cr-grp">
              <button ref={agentChip} type="button" className="cr-chip" title="Choose your agent" aria-haspopup="menu" onClick={(e) => setAgentAnchor(e.currentTarget.getBoundingClientRect())}>
                <AgentIcon size={14} /> <span className="cr-aname">{agent.agent ?? "Atlas"}</span>
              </button>
              <button type="button" role="switch" aria-checked={agent.active} aria-label="Let the agent help with this prompt" title={agent.agent ? "Agent help on or off" : "Choose an agent first"} className={`cr-switch ${agent.active ? "is-on" : ""}`}
                onClick={() => { if (!agent.agent) { if (agentChip.current) setAgentAnchor(agentChip.current.getBoundingClientRect()); return; } agent.setOn(!agent.on); }}><i /></button>
            </div>
            <button type="submit" className="cn-send" aria-label="Send" disabled={busy || !text.trim()}><ArrowUp size={18} /></button>
          </div>
        </form>
      </div>
      {picking && <ReferencePicker max={3} picked={picked} onChange={setPicked} onClose={() => setPicking(false)} />}
      {agent.active && agent.agent && <AgentWidget name={agent.agent} watch={null} />}
      {agentAnchor && <AgentMenu anchor={agentAnchor} selected={agent.agent} onPick={(n) => agent.setAgent(n)} onClose={() => setAgentAnchor(null)} />}
      <div ref={end} />
    </div>
  );
}

export default function ConnectHome() {
  return <Suspense fallback={null}><ConnectChat /></Suspense>;
}
