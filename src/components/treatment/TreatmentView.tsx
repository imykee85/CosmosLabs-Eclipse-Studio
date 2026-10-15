"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Copy, FileText, Loader2, Trash2, Link2, MessagesSquare, MapPin, Mic, MoreHorizontal, Package, Paperclip, Palette, Send, Lightbulb, Upload, User, X } from "lucide-react";
import AgentIcon from "@/components/AgentIcon";
import AgentMenu from "@/components/create/AgentMenu";
import AgentWidget from "@/components/create/AgentWidget";
import { useAgent } from "@/lib/use-agent";
import { useAgentHost } from "@/lib/agent-chat";
import { readCurrentProject } from "@/lib/projects";
import { cleanTreatment, EMPTY_TREATMENT, hasTreatment, treatmentText, type Treatment } from "@/lib/treatment";
import "@/components/create/create.css";
import "./treatment.css";

type Mode = "brief" | "concept" | "guide";

// Brief, Concept, Guide: the same order on desktop cards and phone tabs.
const MODES: { id: Mode; label: string; title: string; hint: string; start: string; icon: React.ReactNode; tabIcon: React.ReactNode; greeting: string; media: boolean }[] = [
  {
    id: "brief", label: "Brief", title: "Upload a brief", icon: <Upload size={18} />, tabIcon: <FileText size={17} />,
    hint: "Already have a brief? Eclipse pulls out the goals, audience and requirements, then suggests concepts.",
    start: "Paste or upload your brief and the goals, audience and requirements are pulled out for you.",
    greeting: "Paste or upload your brief. I'll pick out the goals, audience and requirements, then suggest concepts to build on.", media: false,
  },
  {
    id: "concept", label: "Concept", title: "Describe your idea", icon: <Lightbulb size={18} />, tabIcon: <Lightbulb size={17} />,
    hint: "Tell us what you have in mind and shape it into a concept together.",
    start: "Describe your idea and shape it into a concept in chat.",
    greeting: "What's the idea? Tell me what you picture, even roughly, and we'll shape it into a concept together.", media: true,
  },
  {
    id: "guide", label: "Guide", title: "Answer questions", icon: <MessagesSquare size={18} />, tabIcon: <MessagesSquare size={17} />,
    hint: "Not sure where to begin? Answer a few questions and your brief builds up step by step.",
    start: "Answer a few questions and your brief builds up step by step.",
    greeting: "What product are we making this video for?", media: true,
  },
];

const MEDIA = [
  { label: "Character", icon: <User size={14} /> },
  { label: "Product", icon: <Package size={14} /> },
  { label: "Location", icon: <MapPin size={14} /> },
  { label: "Style", icon: <Palette size={14} /> },
];

type Msg = { id: string; role: "user" | "assistant"; text: string; full?: string; error?: boolean };
const uid = () => Math.random().toString(36).slice(2, 10);
const TEXT_FILE = /\.(txt|md|csv|json)$/i;
const KEY = (project: string) => `eclipse-treatment-${project}`;

export default function TreatmentView() {
  const router = useRouter();
  // null = the starting-point screen (desktop). Phones have no such screen, so they open on the first tab.
  const [mode, setMode] = useState<Mode | null>(null);
  const active = MODES.find((m) => m.id === (mode ?? "brief"))!;
  const [files, setFiles] = useState<File[]>([]);
  const [text, setText] = useState("");
  // The conversation and the plan built from it (a treatment), kept in this browser per project.
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [plan, setPlan] = useState<Treatment>(EMPTY_TREATMENT);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [ready, setReady] = useState(false);
  const [project, setProject] = useState("default");
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const id = readCurrentProject()?.id ?? "default";
    setProject(id);
    try {
      const d = JSON.parse(localStorage.getItem(KEY(id)) ?? "null");
      if (d && Array.isArray(d.msgs)) setMsgs(d.msgs.filter((m: Msg) => m && typeof m.text === "string" && (m.role === "user" || m.role === "assistant")).slice(-60));
      if (d?.plan) setPlan(cleanTreatment(d.plan));
      if (d?.mode === "brief" || d?.mode === "concept" || d?.mode === "guide") setMode(d.mode);
    } catch {}
    setReady(true);
  }, []);
  useEffect(() => {
    if (!ready) return;
    try { localStorage.setItem(KEY(project), JSON.stringify({ mode, msgs: msgs.slice(-60), plan })); } catch {}
  }, [ready, project, mode, msgs, plan]);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [msgs.length, busy]);

  // The agent: pick one (chip) and switch it on (switch). On, it floats on the screen like in Image Studio and its card is the chat.
  const agent = useAgent();
  const [agentAnchor, setAgentAnchor] = useState<DOMRect | null>(null);
  const agentChip = useRef<HTMLButtonElement>(null);
  useAgentHost({
    page: "treatment",
    context: () => ({ prompt: text, settings: treatmentText(plan).split("\n").slice(0, 14) }),
    setPrompt: setText,
    generate: async () => "Pictures are made in Image Studio. Open it and I can start the render there.",
  });
  const picker = useRef<HTMLInputElement>(null);
  async function send() {
    const typed = text.trim();
    if ((!typed && !files.length) || busy) return;
    setError("");
    // Text files are read here and sent with the message; other kinds of file cannot be read yet.
    const readable = files.filter((f) => TEXT_FILE.test(f.name) && f.size <= 200_000);
    if (files.length && readable.length < files.length) setError("Only text files (.txt, .md, .csv, .json, up to 200 KB) can be read for now. Paste the text of other files instead.");
    let full = typed;
    for (const f of readable) full += `\n\n[Attached file: ${f.name}]\n${(await f.text()).slice(0, 8000)}`;
    if (!full.trim()) return;
    const shown = typed || (readable.length ? `(${readable.map((f) => f.name).join(", ")})` : "");
    const mine: Msg = { id: uid(), role: "user", text: shown + (typed && readable.length ? `\n(attached: ${readable.map((f) => f.name).join(", ")})` : ""), full };
    const history = [...msgs, mine];
    setMsgs(history); setText(""); setFiles([]); setBusy(true);
    try {
      const res = await fetch("/api/treatment/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: active.id, treatment: plan, messages: history.filter((m) => !m.error).map((m) => ({ role: m.role, text: m.full ?? m.text })) }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setMsgs((l) => [...l, { id: uid(), role: "assistant", text: typeof data.error === "string" ? data.error : "The planner couldn't answer. Please try again.", error: true }]); return; }
      if (data.treatment) setPlan(cleanTreatment(data.treatment));
      setMsgs((l) => [...l, { id: uid(), role: "assistant", text: String(data.text ?? "") }]);
    } catch {
      setMsgs((l) => [...l, { id: uid(), role: "assistant", text: "I couldn't reach the server. Check your connection and try again.", error: true }]);
    } finally { setBusy(false); }
  }
  const continueToPrompts = () => {
    try { if (hasTreatment(plan)) sessionStorage.setItem("eclipse-treatment-handoff", treatmentText(plan)); } catch {}
    router.push("/prompts");
  };
  const copyPlan = async () => { try { await navigator.clipboard.writeText(treatmentText(plan)); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch {} };
  const newPlan = () => { if (busy) return; setMsgs([]); setPlan(EMPTY_TREATMENT); setError(""); };

  const addFiles = (list: FileList | null) => { const picked = Array.from(list ?? []); if (picked.length) setFiles((f) => [...f, ...picked]); if (picker.current) picker.current.value = ""; };

  return (
    <div className="tr-wrap">
      <div className="tr-head">
        <div className="tr-head-text">
          <h1 className="pg-title">Treatment</h1>
          <p>{mode ? active.start : "Answer a few questions and Eclipse shapes your video concept. Optional."}</p>
        </div>
        <div className="tr-actions">
          <span className="tr-pill tr-pill-quiet tr-pill-wide"><Lightbulb size={13} /> {plan.title || (hasTreatment(plan) ? "Concept in progress" : "No concept yet")}</span>
          <span className="tr-pill tr-pill-quiet tr-pill-short" aria-label={plan.title || "No concept yet"}><Lightbulb size={14} /></span>
          <button type="button" className="tr-pill tr-pill-go" onClick={continueToPrompts}>
            <span className="tr-wide">Continue to prompts</span><span className="tr-short">Prompts</span> <ArrowRight size={15} />
          </button>
          <button type="button" className="tr-more" aria-label="More options"><MoreHorizontal size={17} /></button>
        </div>
      </div>

      <div className="tr-tabs" role="tablist" aria-label="Treatment mode">
        {MODES.map((m) => (
          <button key={m.id} type="button" role="tab" aria-selected={m.id === active.id} className={`tr-tab ${m.id === active.id ? "is-on" : ""}`} onClick={() => setMode(m.id)}>
            {m.tabIcon}{m.label}
          </button>
        ))}
      </div>

      {mode === null && (
        <section className="tr-choose" aria-label="Starting point">
          <h2>Let&apos;s plan your video.</h2>
          <p>Choose a starting point:</p>
          <div className="tr-start">
            {MODES.map((m) => (
              <button key={m.id} type="button" className="tr-start-card" onClick={() => setMode(m.id)}>
                <span className="tr-start-top"><span className="tr-ico">{m.icon}</span><b>{m.title}</b></span>
                <span className="tr-start-hint">{m.hint}</span>
                <span className="tr-start-cta">Start <ArrowRight size={14} /></span>
              </button>
            ))}
          </div>
        </section>
      )}

      <section className={`tr-chat ${mode === null ? "is-hidden-desktop" : ""}`} aria-label="Treatment chat">
        <div className="tr-modes">
          {MODES.map((m) => (
            <button key={m.id} type="button" className={`tr-mode ${m.id === active.id ? "is-on" : ""}`} aria-pressed={m.id === active.id} onClick={() => setMode(m.id)}>
              <span className="tr-start-top"><span className="tr-ico">{m.icon}</span><b>{m.title}</b></span>
              <span className="tr-start-hint">{m.hint}</span>
            </button>
          ))}
        </div>

        <p className="tr-tabnote">{active.start}</p>
        <div className="tr-msg">
          <span className="tr-ai">AI</span>
          <div className="tr-bubble">
            <p>{active.greeting}</p>
            {active.media && (
              <div className="tr-media">
                <span>Add media:</span>
                {MEDIA.map((x) => <button key={x.label} type="button" className="tr-chip">{x.icon}{x.label}</button>)}
              </div>
            )}
          </div>
        </div>

        {msgs.map((m) => (
          <div key={m.id} className={`tr-msg ${m.role === "user" ? "is-user" : ""}`}>
            {m.role === "assistant" && <span className="tr-ai">AI</span>}
            <div className={`tr-bubble ${m.error ? "is-error" : ""}`}><p>{m.text}</p></div>
          </div>
        ))}
        {busy && <div className="tr-msg"><span className="tr-ai">AI</span><div className="tr-bubble"><p className="tr-typing"><Loader2 size={15} className="cr-spin" /> Thinking…</p></div></div>}
        <div ref={end} />

        {hasTreatment(plan) && (
          <section className="tr-plan" aria-label="Your treatment">
            <div className="tr-plan-head">
              <b>{plan.title || "Your treatment"}</b>
              <span>
                <button type="button" className="tr-tool" aria-label="Copy the treatment" title="Copy the treatment" onClick={() => void copyPlan()}><Copy size={15} />{copied && <i>Copied</i>}</button>
                <button type="button" className="tr-tool" aria-label="Start a new treatment" title="Start a new treatment" onClick={newPlan}><Trash2 size={15} /></button>
              </span>
            </div>
            {([["Idea", plan.logline], ["Audience", plan.audience], ["Goal", plan.goal], ["Tone", plan.tone], ["Look", plan.look], ["Notes", plan.notes]] as const).filter(([, v]) => v).map(([k, v]) => <p key={k}><em>{k}</em>{v}</p>)}
            {plan.structure.length > 0 && <ol>{plan.structure.map((b, i) => <li key={i}>{b}</li>)}</ol>}
          </section>
        )}

        <form className="tr-composer" onSubmit={(e) => { e.preventDefault(); void send(); }}>
          {files.length > 0 && (
            <div className="tr-files">
              {files.map((f, i) => (
                <span key={f.name + i} className="tr-file"><FileText size={14} /><span>{f.name}</span>
                  <button type="button" aria-label={`Remove ${f.name}`} onClick={() => setFiles(files.filter((_, j) => j !== i))}><X size={13} /></button>
                </span>
              ))}
            </div>
          )}
          <textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} aria-label="Your message"
            placeholder={active.id === "brief" ? "Paste your brief or attach a file..." : "Type your answer..."}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void send(); } }} />
          {error && <p className="tr-error" role="alert">{error}</p>}
          <div className="tr-tools">
            <input ref={picker} type="file" multiple hidden accept=".txt,.md,.csv,.json" onChange={(e) => addFiles(e.target.files)} />
            <button type="button" className="tr-tool" aria-label="Attach a brief" title="Attach a brief" onClick={() => picker.current?.click()}><Paperclip size={16} /></button>
            <button type="button" className="tr-tool" aria-label="Add a link"><Link2 size={16} /></button>
            <button type="button" className="tr-tool" aria-label="Voice input"><Mic size={16} /></button>
            <div className="tr-agent">
              <button ref={agentChip} type="button" className="tr-tool tr-agentchip" aria-label="Choose your agent" aria-haspopup="menu" title="Choose your agent" onClick={(e) => setAgentAnchor(e.currentTarget.getBoundingClientRect())}>
                <AgentIcon size={14} /> <span>{agent.agent ?? "Atlas"}</span>
              </button>
              <button type="button" role="switch" aria-checked={agent.active} aria-label="Let the agent help" title={agent.agent ? "Agent help on or off" : "Choose an agent first"} className={`cr-switch ${agent.active ? "is-on" : ""}`}
                onClick={() => { if (!agent.agent) { if (agentChip.current) setAgentAnchor(agentChip.current.getBoundingClientRect()); return; } agent.setOn(!agent.on); }}><i /></button>
            </div>
            <button type="submit" className="tr-send" aria-label="Send" disabled={busy || (!text.trim() && !files.length)}>{busy ? <Loader2 size={16} className="cr-spin" /> : <Send size={16} />}</button>
          </div>
        </form>
      </section>
      {agent.active && agent.agent && <AgentWidget name={agent.agent} watch={null} />}
      {agentAnchor && <AgentMenu anchor={agentAnchor} selected={agent.agent} onPick={(n) => agent.setAgent(n)} onClose={() => setAgentAnchor(null)} />}
    </div>
  );
}
