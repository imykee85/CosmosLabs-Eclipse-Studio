"use client";

import { useRef, useState } from "react";
import { ArrowRight, FileText, Link2, MessagesSquare, MapPin, Mic, MoreHorizontal, Package, Paperclip, Palette, Send, Lightbulb, Upload, User, X } from "lucide-react";
import "./story.css";

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

export default function StoryView() {
  // null = the starting-point screen (desktop). Phones have no such screen, so they open on the first tab.
  const [mode, setMode] = useState<Mode | null>(null);
  const active = MODES.find((m) => m.id === (mode ?? "brief"))!;
  const [files, setFiles] = useState<File[]>([]);
  const [text, setText] = useState("");
  const picker = useRef<HTMLInputElement>(null);
  const addFiles = (list: FileList | null) => { const picked = Array.from(list ?? []); if (picked.length) setFiles((f) => [...f, ...picked]); if (picker.current) picker.current.value = ""; };

  return (
    <div className="st-wrap">
      <div className="st-head">
        <div className="st-head-text">
          <h1>Story</h1>
          <p>{mode ? active.start : "Answer a few questions and Eclipse shapes your video concept. Optional."}</p>
        </div>
        <div className="st-actions">
          <span className="st-pill st-pill-quiet st-pill-wide"><Lightbulb size={13} /> No concept yet</span>
          <span className="st-pill st-pill-quiet st-pill-short" aria-label="No concept yet"><Lightbulb size={14} /></span>
          <button type="button" className="st-pill st-pill-go" disabled title="Prompts are coming soon">
            <span className="st-wide">Continue to prompts</span><span className="st-short">Prompts</span> <ArrowRight size={15} />
          </button>
          <button type="button" className="st-more" aria-label="More options" disabled><MoreHorizontal size={17} /></button>
        </div>
      </div>

      <div className="st-tabs" role="tablist" aria-label="Story mode">
        {MODES.map((m) => (
          <button key={m.id} type="button" role="tab" aria-selected={m.id === active.id} className={`st-tab ${m.id === active.id ? "is-on" : ""}`} onClick={() => setMode(m.id)}>
            {m.tabIcon}{m.label}
          </button>
        ))}
      </div>

      {mode === null && (
        <section className="st-choose" aria-label="Starting point">
          <h2>Let&apos;s plan your video.</h2>
          <p>Choose a starting point:</p>
          <div className="st-start">
            {MODES.map((m) => (
              <button key={m.id} type="button" className="st-start-card" onClick={() => setMode(m.id)}>
                <span className="st-start-top"><span className="st-ico">{m.icon}</span><b>{m.title}</b></span>
                <span className="st-start-hint">{m.hint}</span>
                <span className="st-start-cta">Start <ArrowRight size={14} /></span>
              </button>
            ))}
          </div>
        </section>
      )}

      <section className={`st-chat ${mode === null ? "is-hidden-desktop" : ""}`} aria-label="Story chat">
        <div className="st-modes">
          {MODES.map((m) => (
            <button key={m.id} type="button" className={`st-mode ${m.id === active.id ? "is-on" : ""}`} aria-pressed={m.id === active.id} onClick={() => setMode(m.id)}>
              <span className="st-start-top"><span className="st-ico">{m.icon}</span><b>{m.title}</b></span>
              <span className="st-start-hint">{m.hint}</span>
            </button>
          ))}
        </div>

        <p className="st-tabnote">{active.start}</p>
        <div className="st-msg">
          <span className="st-ai">AI</span>
          <div className="st-bubble">
            <p>{active.greeting}</p>
            {active.media && (
              <div className="st-media">
                <span>Add media:</span>
                {MEDIA.map((x) => <button key={x.label} type="button" className="st-chip" disabled>{x.icon}{x.label}</button>)}
              </div>
            )}
          </div>
        </div>

        <form className="st-composer" onSubmit={(e) => e.preventDefault()}>
          {files.length > 0 && (
            <div className="st-files">
              {files.map((f, i) => (
                <span key={f.name + i} className="st-file"><FileText size={14} /><span>{f.name}</span>
                  <button type="button" aria-label={`Remove ${f.name}`} onClick={() => setFiles(files.filter((_, j) => j !== i))}><X size={13} /></button>
                </span>
              ))}
            </div>
          )}
          <textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} aria-label="Your message"
            placeholder={active.id === "brief" ? "Paste your brief or attach a file..." : "Type your answer..."} />
          <div className="st-tools">
            <input ref={picker} type="file" multiple hidden accept=".pdf,.doc,.docx,.txt,.md,.rtf" onChange={(e) => addFiles(e.target.files)} />
            <button type="button" className="st-tool" aria-label="Attach a brief" title="Attach a brief" onClick={() => picker.current?.click()}><Paperclip size={16} /></button>
            <button type="button" className="st-tool" aria-label="Add a link" title="Links are coming soon" disabled><Link2 size={16} /></button>
            <button type="button" className="st-tool" aria-label="Voice input" title="Voice is coming soon" disabled><Mic size={16} /></button>
            <button type="submit" className="st-send" aria-label="Send" title="Sending is coming soon" disabled><Send size={16} /></button>
          </div>
        </form>
      </section>
    </div>
  );
}
