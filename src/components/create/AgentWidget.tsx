"use client";

import GrowArea from "@/components/GrowArea";
import { thumbOf, fallbackTo } from "@/lib/thumb-url";
import { useEffect, useRef, useState } from "react";
import { ArrowUp, Copy, History, Loader2, Maximize2, Minimize2, Pencil, Plus, RotateCcw, Square, SquarePen, Trash2, X } from "lucide-react";
import AgentIcon from "../AgentIcon";
import { canUseFrame, hostPage, readHostContext, useAgentChat, type Attach, type AttachedDoc } from "@/lib/agent-chat";
import { diffWords, thinkingLines, type Proposal } from "@/lib/agent-proposal";
import type { PlanState } from "@/lib/agent-plan";
import { creditsText } from "@/lib/credit-units";
import { listPlansFor, stopPlan } from "@/lib/agent-plan-run";
import { actOnMission, listMissionsFor, readMission } from "@/lib/agent-mission-run";
import type { MissionSpec, MissionView } from "@/lib/agent-mission-spec";
import { useAccess } from "@/lib/use-access";
import { attachKind, readDocument } from "@/lib/attach-file";
import { uploadPicture, uploadVideo } from "@/lib/use-uploads";
import { readCurrentProject } from "@/lib/projects";
import { CUE_EVENT, takeCue } from "@/lib/use-agent";
import { MAX_ATTACH } from "@/lib/limits";

const SIZE = 64;

// Where Atlas may stand (owner 2026-10-21): never up in the header, never below a prompt box, and beside the open sidebar (it moves with it).
const BOXES = ".cr-dock, .cr-box, .vc-console-wrap, .cn-dock, .cn-box, .pm-box, .tr-composer, .mt-composer";
const seen = (el: Element) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 ? r : null; };
const headerBottom = () => { for (const el of Array.from(document.querySelectorAll(".mb-top, .ws-topbar"))) { const r = seen(el); if (r) return Math.max(0, r.bottom); } return 0; };
// The sidebar (desktop) or the menu drawer (phone), when open: Atlas stands just right of its edge.
const sidebarEdge = () => {
  let edge = 0;
  for (const el of Array.from(document.querySelectorAll(".ws-sidebar, .mb-panel"))) {
    const r = seen(el);
    if (r && r.right > 0 && r.left <= 1) edge = Math.max(edge, r.right);
  }
  return Math.min(edge, Math.max(0, window.innerWidth - SIZE));
};
const boxTop = (above: number) => {
  let top = window.innerHeight;
  for (const el of Array.from(document.querySelectorAll(BOXES))) { const r = seen(el); if (r && r.top > above + SIZE && r.top < top) top = r.top; }
  return top;
};
const limits = () => { const minY = headerBottom(); return { minY, maxY: Math.max(minY, Math.min(window.innerHeight, boxTop(minY)) - SIZE - 6) }; };

// A picture or clip added in the chat, shown as what it is (not an icon): the picture's small copy, or the clip's first frame.
function Thumb({ kind, id, name, big = false }: { kind: "picture" | "video"; id: string; name: string; big?: boolean }) {
  const cls = big ? "aw-thumb is-big" : "aw-thumb";
  if (kind === "video") return <video className={cls} src={`/api/generations/${id}/file#t=0.1`} muted playsInline preload="metadata" aria-label={name} />;
  const full = `/api/uploads/${id}/file`;
  // eslint-disable-next-line @next/next/no-img-element
  return <img className={cls} src={thumbOf("upload", id)} alt={name} onError={fallbackTo(full)} draggable={false} />;
}

// The agent as a little 3D character: a ball that always stays round, with two eyes that sit on its surface and travel round it. It floats, blinks, turns its head toward your
// finger or cursor, and spins all the way round when you tap it. Real CSS 3D (no images), drawn in the theme's colours.
function Bot() {
  return (
    <div className="aw-3d" aria-hidden="true">
      <div className="aw-float">
        <div className="aw-ball" />
        <div className="aw-spin">
          <div className="aw-sphere">
            <i className="aw-eye aw-eye-l"><b /></i>
            <i className="aw-eye aw-eye-r"><b /></i>
          </div>
        </div>
      </div>
      <div className="aw-ground" />
    </div>
  );
}

// What shows while Atlas works: short creative lines that change every couple of seconds (more of them for the studio he is in).
function Thinking() {
  const lines = thinkingLines(hostPage());
  const [i, setI] = useState(() => Math.floor(Math.random() * lines.length));
  useEffect(() => { const id = window.setInterval(() => setI((n) => n + 1), 2200); return () => window.clearInterval(id); }, []);
  return <p className="aw-typing"><Loader2 size={13} className="cr-spin" /> {lines[i % lines.length]}…</p>;
}

// Atlas's proposal as one card: the old prompt struck through, the new one with the added words marked, the settings it would change, and two buttons.
function ProposalCard({ p, busy, onApply }: { p: Proposal; busy: boolean; onApply: (andGenerate: boolean) => void }) {
  const done = !!p.applied;
  const pieces = p.prompt ? diffWords(p.before, p.prompt) : [];
  return (
    <div className="aw-prop">
      {p.prompt && (
        <div className="aw-prop-box">
          <span className="aw-prop-lab">Prompt</span>
          {p.before.trim() && <span className="aw-prop-old">{p.before}</span>}
          <span className="aw-prop-new">{pieces.map((x, i) => (x.added && p.before.trim() ? <mark key={i}>{x.text}</mark> : <span key={i}>{x.text}</span>))}</span>
        </div>
      )}
      {p.settings.length > 0 && (
        <div className="aw-prop-set">
          {p.settings.map((l) => (<div key={l.label}><span>{l.label}</span><span>{l.from ? <s>{l.from}</s> : null} {l.to}</span></div>))}
        </div>
      )}
      <div className="aw-prop-btns">
        <button type="button" className="aw-prop-apply" disabled={done || busy} onClick={() => onApply(false)}>{p.applied === "apply" ? "Applied \u2713" : "Apply"}</button>
        <button type="button" className="aw-prop-gen" disabled={done || busy} onClick={() => onApply(true)}>{p.applied === "generate" ? "Applied \u2713" : "Apply and generate"}</button>
      </div>
    </div>
  );
}

// A plan Atlas proposed (Scale): the steps, the total price, and one Approve button that runs the whole thing.
function PlanCard({ plan, busy, onApprove, onStop }: { plan: PlanState; busy: boolean; onApprove: () => void; onStop: () => void }) {
  const running = plan.status === "running";
  return (
    <div className="aw-prop aw-plan">
      <div className="aw-plan-title">{plan.spec.title}</div>
      <ol className="aw-plan-steps">
        {plan.steps.map((s) => (
          <li key={s.id} className={`is-${s.state}`}>
            <span className="aw-plan-dot" aria-hidden>{s.state === "done" ? "\u2713" : s.state === "failed" ? "!" : s.state === "running" ? "\u2026" : ""}</span>
            <span>{s.label}{s.error ? <em className="aw-plan-err"> {s.error}</em> : null}</span>
          </li>
        ))}
      </ol>
      {plan.price != null && plan.status === "ready" && <div className="aw-plan-price">Total {creditsText(plan.price)}</div>}
      {plan.note && <p className="aw-plan-note">{plan.note}</p>}
      <div className="aw-prop-btns">
        {plan.status === "ready" && <button type="button" className="aw-prop-gen" disabled={busy} onClick={onApprove}>Approve plan</button>}
        {running && <button type="button" className="aw-prop-apply" onClick={onStop}>Stop after this step</button>}
        {plan.status === "done" && <span className="aw-plan-done">All done. It is in your Gallery.</span>}
        {plan.status === "canceled" && <span className="aw-plan-done">Stopped.</span>}
      </div>
    </div>
  );
}

// A mission Atlas proposed (Scale): Start mission, then the live trace (what it does, step by step), Approve / Decline on its spending requests, an answer box when it asks, and Stop.
function MissionCard({ spec, id, error, busy, onStart }: { spec: MissionSpec; id?: string; error?: string; busy: boolean; onStart: () => void }) {
  const [view, setView] = useState<MissionView | null>(null);
  const [reply, setReply] = useState("");
  const [err, setErr] = useState("");
  const [working, setWorking] = useState(false);
  const live = !view || view.status === "running" || view.status.startsWith("waiting");
  useEffect(() => {
    if (!id || !live) return;
    let stop = false;
    const look = async () => {
      const v = await readMission(id);
      if (stop) return;
      if (v === "gone") { setErr("This mission can no longer be found."); return; }
      if (v) setView(v);
    };
    void look();
    const t = setInterval(() => { if (document.visibilityState === "visible") void look(); }, 4000);
    return () => { stop = true; clearInterval(t); };
  }, [id, live]);
  const act = async (b: Parameters<typeof actOnMission>[1]) => {
    if (!id) return;
    setWorking(true); setErr("");
    const r = await actOnMission(id, b);
    setWorking(false);
    if ("error" in r) setErr(r.error); else { setView(r); setReply(""); }
  };
  const w = view?.waiting;
  const shown = view?.trace.filter((t) => t.kind !== "result").slice(-12) ?? [];
  return (
    <div className="aw-prop aw-mission">
      <div className="aw-plan-title">Mission</div>
      <p className="aw-mission-goal">{spec.goal}</p>
      {!id && (
        <>
          <p className="aw-plan-note">{spec.autopilot && spec.budget > 0 ? `Atlas may commit up to ${spec.budget} credits on its own. Anything beyond that waits for you.` : "Atlas asks before every spend."} It keeps going if you close the app.</p>
          {error && <p className="aw-plan-note aw-plan-err">{error}</p>}
          <div className="aw-prop-btns"><button type="button" className="aw-prop-gen" disabled={busy} onClick={onStart}>Start mission</button></div>
        </>
      )}
      {id && (
        <>
          <ol className="aw-mission-trace" aria-live="polite">
            {shown.map((t, i) => <li key={i} className={`k-${t.kind}`}>{t.text}</li>)}
            {!view && <li className="k-note">Starting…</li>}
          </ol>
          {view && view.committed > 0 && <div className="aw-plan-price">Committed {creditsText(view.committed)}</div>}
          {w?.kind === "approval" && (
            <div className="aw-mission-ask">
              <ul>{w.calls?.map((c) => <li key={c.id}>{c.summary}{c.price != null ? ` · ${creditsText(c.price)}` : ""}</li>)}</ul>
              {w.total != null && <div className="aw-plan-price">Total {creditsText(w.total)}</div>}
              <div className="aw-prop-btns">
                <button type="button" className="aw-prop-gen" disabled={working} onClick={() => void act({ action: "approve" })}>Approve</button>
                <button type="button" className="aw-prop-apply" disabled={working} onClick={() => void act({ action: "decline" })}>Decline</button>
              </div>
            </div>
          )}
          {(w?.kind === "question" || w?.kind === "chat") && (
            <form className="aw-mission-ask" onSubmit={(e) => { e.preventDefault(); if (reply.trim()) void act({ action: "reply", text: reply }); }}>
              <p>{w.question}</p>
              <div className="aw-mission-reply">
                <input value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Your answer" aria-label="Your answer" />
                <button type="submit" className="aw-prop-gen" disabled={working || !reply.trim()}>Send</button>
              </div>
            </form>
          )}
          {view?.summary && <p className="aw-plan-note">{view.summary}</p>}
          {err && <p className="aw-plan-note aw-plan-err">{err}</p>}
          <div className="aw-prop-btns">
            {live && view && <button type="button" className="aw-prop-apply" disabled={working} onClick={() => void act({ action: "cancel" })}>Stop mission</button>}
            {view?.status === "done" && <span className="aw-plan-done">Finished. What it made is in your Gallery.</span>}
            {view?.status === "canceled" && <span className="aw-plan-done">Stopped.</span>}
          </div>
        </>
      )}
    </div>
  );
}

// Past and running plans (Scale), newest first: the history under the chat history. Opening one shows its card; a running one can be stopped.
const STATUS_LABEL: Record<string, string> = { running: "Running", done: "Done", failed: "Stopped with a problem", canceled: "Stopped", ready: "Waiting for approval" };
function PlansHistory() {
  const [items, setItems] = useState<{ id: string; createdAt: string; plan: PlanState }[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    const load = () => void listPlansFor().then((l) => { if (live) setItems(l); });
    load();
    const t = setInterval(load, 8000);
    return () => { live = false; clearInterval(t); };
  }, []);
  if (!items || items.length === 0) return null;
  return (
    <div className="aw-plans-hist">
      <h4 className="aw-plans-title">Your plans</h4>
      {items.map((p) => (
        <div key={p.id} className="aw-past-row aw-plan-row">
          <button type="button" aria-expanded={openId === p.id} onClick={() => setOpenId(openId === p.id ? null : p.id)}><b>{p.plan.spec.title}</b><span>{new Date(p.createdAt).toLocaleDateString(undefined, { day: "numeric", month: "short" })} · {STATUS_LABEL[p.plan.status] ?? p.plan.status}</span></button>
          {openId === p.id && <PlanCard plan={p.plan} busy={false} onApprove={() => {}} onStop={() => void stopPlan(p.id)} />}
        </div>
      ))}
    </div>
  );
}

// Past and running missions (Scale), newest first, under the plans. Opening one shows its live card (trace, approvals, Stop).
const MISSION_LABEL: Record<string, string> = { running: "Working", waiting_approval: "Needs your OK", waiting_user: "Needs your answer", done: "Done", failed: "Stopped with a problem", canceled: "Stopped" };
function MissionsHistory() {
  const [items, setItems] = useState<MissionView[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    const load = () => void listMissionsFor().then((l) => { if (live) setItems(l); });
    load();
    const t = setInterval(load, 10000);
    return () => { live = false; clearInterval(t); };
  }, []);
  if (!items || items.length === 0) return null;
  return (
    <div className="aw-plans-hist">
      <h4 className="aw-plans-title">Your missions</h4>
      {items.map((m) => (
        <div key={m.id} className="aw-past-row aw-plan-row">
          <button type="button" aria-expanded={openId === m.id} onClick={() => setOpenId(openId === m.id ? null : m.id)}><b>{m.goal.slice(0, 60)}</b><span>{new Date(m.createdAt).toLocaleDateString(undefined, { day: "numeric", month: "short" })} · {MISSION_LABEL[m.status] ?? m.status}</span></button>
          {openId === m.id && <MissionCard spec={{ goal: m.goal, budget: Math.round(m.budget / 10), autopilot: m.autopilot }} id={m.id} busy={false} onStart={() => {}} />}
        </div>
      ))}
    </div>
  );
}

// The panel's quick chips (shown while the chat is empty): each one sends a plain message Atlas can act on.
const CHIPS: { label: string; text: string; needsRef?: boolean }[] = [
  { label: "Improve my prompt", text: "Improve my prompt." },
  { label: "Help me start", text: "Help me start. Ask me a few short questions, one at a time, then write the prompt." },
  { label: "Match my reference", text: "Match the look of the reference picture in my prompt box.", needsRef: true },
  { label: "Make it moodier", text: "Make my prompt moodier." },
];

// A floating agent button that appears while the agent switch is on. Drag it anywhere on the screen (it stays where you
// leave it, remembered in this browser); tap it to open a small card about the agent.
export default function AgentWidget({ name, watch }: { name: string; watch?: string | null }) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [open, setOpen] = useState(false);
  const [hop, setHop] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [bounce, setBounce] = useState(false);
  const [big, setBig] = useState(false);
  const [showPast, setShowPast] = useState(false);
  const canPlans = useAccess().can("plans");
  // Pictures and videos added in the chat itself (paperclip): uploaded at once, sent with the next message.
  const [atts, setAtts] = useState<Attach[]>([]);
  const [docs, setDocs] = useState<AttachedDoc[]>([]);
  const [uploading, setUploading] = useState<number | null>(null);
  const uploadsRunning = useRef(0); // picks still uploading; the spinner clears only when the last one ends
  const [attErr, setAttErr] = useState("");
  const fileIn = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);
  const [viewing, setViewing] = useState<{ kind: "picture" | "video"; id: string; name: string } | null>(null);
  const chat = useAgentChat(name);
  // The latest real answer (not a status note) gets the Try again button.
  const lastAgent = chat.messages.reduce((n, m, i) => (m.role === "agent" && !m.note ? i : n), -1);
  const list = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const hbot = useRef<HTMLSpanElement>(null);
  const [nod, setNod] = useState(false);
  const [refs, setRefs] = useState<{ type: "upload" | "render"; id: string; role?: string }[]>([]);
  const drag = useRef<{ dx: number; dy: number; sx: number; sy: number; moved: boolean } | null>(null);

  const baseX = useRef(0); // the sidebar's edge the position was last measured against
  const clamp = (x: number, y: number) => { const { minY, maxY } = limits(); return { x: Math.min(Math.max(0, x), Math.max(0, window.innerWidth - SIZE)), y: Math.min(Math.max(minY, y), maxY) }; };

  useEffect(() => {
    // Every time the agent is switched on it stands in the same default spot (owner 2026-10-21): right under the menu icon at the top left, and beside the sidebar
    // when that is open. When the sidebar opens or closes Atlas moves with it. Dragging moves it for this visit only; nothing is remembered.
    baseX.current = sidebarEdge();
    setPos(clamp(baseX.current, headerBottom()));
    const sync = () => setPos((q) => {
      if (!q) return q;
      const edge = sidebarEdge();
      const dx = edge - baseX.current;
      baseX.current = edge;
      const n = clamp(q.x + dx, q.y);
      return n.x === q.x && n.y === q.y ? q : n;
    });
    let frames = 0;
    const burst = () => { frames = Math.max(frames, 40); if (frames === 40) tick(); };
    const tick = () => { sync(); if (--frames > 0) requestAnimationFrame(tick); };
    const slow = window.setInterval(sync, 700);
    const root = document.querySelector(".ws-root");
    const watch = root ? new MutationObserver(burst) : null;
    watch?.observe(root!, { attributes: true, attributeFilter: ["class"], subtree: true });
    window.addEventListener("resize", burst);
    window.visualViewport?.addEventListener("resize", burst);
    document.addEventListener("transitionrun", burst, true);
    document.addEventListener("click", burst, true);
    return () => {
      window.clearInterval(slow); watch?.disconnect();
      window.removeEventListener("resize", burst); window.visualViewport?.removeEventListener("resize", burst);
      document.removeEventListener("transitionrun", burst, true); document.removeEventListener("click", burst, true);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // The eyes look toward the pointer (or the last touch) wherever it is on the screen.
  const watching = useRef<string | null>(null);
  watching.current = watch ?? null;
  useEffect(() => {
    const look = (e: PointerEvent) => {
      for (const el of [btn.current, hbot.current]) {
        if (!el || (el === btn.current && watching.current)) continue;
        const r = el.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
        const d = Math.hypot(dx, dy) || 1;
        const k = Math.min(1, d / 160);
        el.style.setProperty("--lx", String((dx / d) * k));
        el.style.setProperty("--ly", String((dy / d) * k));
      }
    };
    window.addEventListener("pointermove", look);
    window.addEventListener("pointerdown", look);
    return () => { window.removeEventListener("pointermove", look); window.removeEventListener("pointerdown", look); };
  }, []);

  // While something is being made, the agent keeps its eyes on the preview (the element named by `watch`).
  useEffect(() => {
    if (!watch) return;
    const tick = () => {
      const el = btn.current;
      const target = document.querySelector(watch);
      if (!el || !target) return;
      const r = el.getBoundingClientRect(), t = target.getBoundingClientRect();
      const dx = t.left + t.width / 2 - (r.left + r.width / 2), dy = t.top + t.height / 2 - (r.top + r.height / 2);
      const d = Math.hypot(dx, dy) || 1;
      const k = Math.min(1, d / 120);
      el.style.setProperty("--lx", String((dx / d) * k));
      el.style.setProperty("--ly", String((dy / d) * k));
    };
    tick();
    const id = window.setInterval(tick, 120);
    return () => window.clearInterval(id);
  }, [watch]);

  // Switched on: spin and open with an introduction. Switched to another agent: a little bounce and that agent's introduction.
  const [cue, setCue] = useState(() => takeCue());
  useEffect(() => {
    const on = () => { const c = takeCue(); if (c) setCue(c); };
    window.addEventListener(CUE_EVENT, on);
    return () => window.removeEventListener(CUE_EVENT, on);
  }, []);
  useEffect(() => {
    if (!cue || cue.agent !== name || !pos) return;
    setCue(null);
    if (cue.kind === "on") { setHop(true); window.setTimeout(() => setHop(false), 1000); }
    else { setBounce(true); window.setTimeout(() => setBounce(false), 700); }
  }, [cue, name, pos]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const o = () => setOpen(true); window.addEventListener("eclipse-agent-open", o); return () => window.removeEventListener("eclipse-agent-open", o); }, []);
  useEffect(() => { const o = () => { setNod(true); window.setTimeout(() => setNod(false), 750); }; window.addEventListener("eclipse-agent-nod", o); return () => window.removeEventListener("eclipse-agent-nod", o); }, []);
  // While the panel is open it shows the pictures that are in the prompt box right now (numbered like the box), and closes on Escape.
  useEffect(() => {
    if (!open) return;
    const read = () => {
      const pics = readHostContext()?.pictures ?? [];
      setRefs((cur) => (JSON.stringify(cur) === JSON.stringify(pics) ? cur : pics.slice(0, MAX_ATTACH)));
    };
    read();
    const id = window.setInterval(read, 800);
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", esc);
    return () => { window.clearInterval(id); window.removeEventListener("keydown", esc); };
  }, [open]);
  useEffect(() => { const el = list.current; if (el) el.scrollTop = el.scrollHeight; }, [chat.messages.length, chat.busy, open, big]);
  useEffect(() => { if (!open) { setBig(false); setShowPast(false); } }, [open]);
  // On desktop the screen makes room for the open panel (the studio centres between the sidebar and the panel); CSS reads this mark.
  useEffect(() => {
    if (!open) return;
    document.documentElement.dataset.atlasPanel = big ? "big" : "on";
    return () => { delete document.documentElement.dataset.atlasPanel; };
  }, [open, big]);

  if (!pos) return null;

  function submit(e?: React.FormEvent) {
    e?.preventDefault();
    const t = draft.trim();
    if (!t || chat.busy || uploading !== null) return;
    setDraft("");
    const sent = atts;
    const sentDocs = docs;
    setAtts([]);
    setDocs([]);
    setAttErr("");
    void chat.send(t, sent, sentDocs);
  }

  async function addFiles(files: FileList | null) {
    const list = Array.from(files ?? []).slice(0, MAX_ATTACH);
    if (fileIn.current) fileIn.current.value = "";
    if (!list.length) return;
    setAttErr("");
    const projectId = readCurrentProject()?.id ?? null;
    uploadsRunning.current += 1;
    for (const f of list) {
      const name = f.name.replace(/\.[^.]+$/, "").slice(0, 80) || "Attachment";
      const kind = attachKind(f);
      setUploading(0);
      if (kind === "document") {
        const r = await readDocument(f);
        if (r.ok) setDocs((d) => [...d, { name: r.name, text: r.text, pdf: r.pdf }].slice(-MAX_ATTACH));
        else setAttErr(r.error);
        continue;
      }
      if (kind === "video") {
        const r = await uploadVideo<{ id: string }>(f, name, projectId, setUploading);
        if (r.ok && r.item?.id) setAtts((a) => [...a, { kind: "video" as const, id: r.item.id, name }].slice(-MAX_ATTACH));
        else setAttErr(r.ok ? "Could not add that video." : r.error);
      } else {
        const r = await uploadPicture(f, "asset", name, projectId, setUploading);
        if (r.ok && r.item?.id) setAtts((a) => [...a, { kind: "picture" as const, id: r.item!.id, name }].slice(-MAX_ATTACH));
        else setAttErr(r.ok ? "Could not add that picture." : r.error);
      }
    }
    uploadsRunning.current -= 1;
    if (uploadsRunning.current === 0) setUploading(null);
  }

  function down(e: React.PointerEvent<HTMLButtonElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { dx: e.clientX - pos!.x, dy: e.clientY - pos!.y, sx: e.clientX, sy: e.clientY, moved: false };
  }
  function move(e: React.PointerEvent<HTMLButtonElement>) {
    const d = drag.current;
    if (!d) return;
    if (!d.moved && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 6) return;
    d.moved = true;
    setDragging(true);
    setPos(clamp(e.clientX - d.dx, e.clientY - d.dy));
  }
  function up() {
    const d = drag.current;
    drag.current = null;
    setDragging(false);
    if (!d) return;
    else setOpen(true); // tapping opens the card; the spin is for switching the agent on (see the cue effect)
  }

  return (
    <>
      {viewing && (
        <div className="aw-view" role="dialog" aria-label={viewing.name} onClick={() => setViewing(null)}>
          <button type="button" className="aw-view-x" aria-label="Close" onClick={() => setViewing(null)}><X size={18} /></button>
          {viewing.kind === "video"
            ? <video className="aw-view-media" src={`/api/generations/${viewing.id}/file`} controls playsInline autoPlay onClick={(e) => e.stopPropagation()} />
            : <img className="aw-view-media" src={`/api/uploads/${viewing.id}/file`} alt={viewing.name} onClick={(e) => e.stopPropagation()} />}
        </div>
      )}
      {open && <div className="aw-dim" onClick={() => setOpen(false)} />}
      {open && (
        <div className={`aw-card aw-panel ${big ? "is-big" : ""}`} role="dialog" aria-label={`${name} chat`} style={{ ["--aw-top" as string]: `${headerBottom()}px` }}>
          <div className="aw-grab" aria-hidden="true" />
          <div className="aw-head"><span ref={hbot} className={`aw-hbot ${chat.busy ? "is-thinking" : ""} ${nod ? "is-nod" : ""}`} aria-hidden="true"><Bot /></span><b>{name}</b>
            <button type="button" aria-label="Chat history" title="Chat history" className={showPast ? "is-on" : ""} onClick={() => setShowPast((v) => !v)}><History size={15} /></button>
            <button type="button" aria-label="New chat" title="New chat" disabled={chat.busy} onClick={() => { chat.newChat(); setShowPast(false); }}><SquarePen size={14} /></button>
            <button type="button" aria-label={big ? "Make smaller" : "Expand"} title={big ? "Make smaller" : "Expand"} onClick={() => setBig((b) => !b)}>{big ? <Minimize2 size={15} /> : <Maximize2 size={15} />}</button>
            <button type="button" aria-label="Close" onClick={() => setOpen(false)}><X size={15} /></button></div>
          {showPast ? (
            <div className="aw-msgs aw-past">
              {chat.past.length === 0 && !canPlans && <p className="aw-empty">No earlier chats yet. Press New chat to keep this one and start another.</p>}
              {chat.past.map((c) => (
                <div key={c.id} className="aw-past-row">
                  <button type="button" onClick={() => { chat.openPast(c.id); setShowPast(false); }}><b>{c.title}</b><span>{new Date(c.at).toLocaleDateString(undefined, { day: "numeric", month: "short" })} · {c.messages.length} messages</span></button>
                  <button type="button" className="aw-past-del" aria-label="Delete this chat" title="Delete this chat" onClick={() => chat.deletePast(c.id)}><Trash2 size={13} /></button>
                </div>
              ))}
              {canPlans && <PlansHistory />}
              {canPlans && <MissionsHistory />}
            </div>
          ) : (
          <>
          {(
            <div className="aw-refs">
              <span className="aw-refs-lab">Using</span>
              {refs.map((r, i) => (
                <span key={r.id + i} className="aw-ref" title={r.role ? `${i + 1}. ${r.role}` : `${i + 1}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={thumbOf(r.type, r.id)} alt="" draggable={false} onError={fallbackTo(r.type === "upload" ? `/api/uploads/${r.id}/file` : `/api/generations/${r.id}/file`)} />
                  <i>{i + 1}</i>
                </span>
              ))}
              <button type="button" className="aw-ref-add" aria-label="Add a picture or video" title="Add a picture or video" disabled={chat.busy || atts.length + docs.length >= MAX_ATTACH} onClick={() => fileIn.current?.click()}><Plus size={16} /></button>
            </div>
          )}
          <div className="aw-msgs" ref={list} aria-live="polite">
            {chat.messages.length === 0 && <p className="aw-empty">Say hello, or tell me what you want to make.</p>}
            {chat.messages.length === 0 && (
              <div className="aw-chips">
                {CHIPS.filter((c) => !c.needsRef || refs.length > 0).map((c) => (<button key={c.label} type="button" disabled={chat.busy} onClick={() => void chat.send(c.text)}>{c.label}</button>))}
              </div>
            )}
            {chat.messages.map((m, at) => (
              <div key={m.id} className={`aw-msg is-${m.role} ${m.error ? "is-error" : ""} ${m.note ? "is-note" : ""} ${editing?.id === m.id ? "is-editing" : ""}`}>
                {m.attach && m.attach.length > 0 && <div className="aw-attached">{m.attach.map((a, i) => (a.id ? <button key={a.id + i} type="button" className="aw-open" aria-label={`Open ${a.name}`} title="Open" onClick={() => setViewing({ kind: a.kind, id: a.id!, name: a.name })}><Thumb kind={a.kind} id={a.id} name={a.name} big /></button> : <span key={a.name + i} className="aw-att-name">{a.name}</span>))}</div>}
                {editing?.id === m.id ? (
                  <form className="aw-edit" onSubmit={(e) => { e.preventDefault(); const t = editing.text; setEditing(null); void chat.resend(m.id, t); }}>
                    <GrowArea rows={2} value={editing.text} aria-label="Edit your message" autoFocus onChange={(e) => setEditing({ id: m.id, text: e.target.value })}
                      onKeyDown={(e) => { if (e.key === "Escape") setEditing(null); if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); const t = editing.text; setEditing(null); void chat.resend(m.id, t); } }} />
                    <div className="aw-edit-acts">
                      <button type="button" onClick={() => setEditing(null)}>Cancel</button>
                      <button type="submit" className="is-send" disabled={!editing.text.trim()}>Send</button>
                    </div>
                  </form>
                ) : m.text && <p>{m.text}</p>}
                {m.frames && m.frames.length > 0 && (
                  <div className="aw-frames">
                    {m.frames.map((f) => (
                      <figure key={f.id} className="aw-frame">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={`/api/uploads/${f.id}/file`} alt={f.label} loading="lazy" />
                        <figcaption>{f.sec.toFixed(1)} s · saved to Assets</figcaption>
                        {canUseFrame() && (
                          <div className="aw-frame-acts">
                            <button type="button" disabled={!!f.used || chat.busy} onClick={() => void chat.useFrame(m.id, f.id, "start")}>{f.used === "start" ? "Start frame \u2713" : "Use as start frame"}</button>
                            <button type="button" disabled={!!f.used || chat.busy} onClick={() => void chat.useFrame(m.id, f.id, "ingredient")}>{f.used === "ingredient" ? "Ingredient \u2713" : "Use as ingredient"}</button>
                          </div>
                        )}
                      </figure>
                    ))}
                  </div>
                )}
                {m.mission && <MissionCard spec={m.mission.spec} id={m.mission.id} error={m.mission.error} busy={chat.busy} onStart={() => void chat.startMission(m.id)} />}
                {m.plan && <PlanCard plan={m.plan} busy={chat.busy} onApprove={() => void chat.approvePlan(m.id)} onStop={() => chat.cancelPlan(m.id)} />}
                {m.proposal && <ProposalCard p={m.proposal} busy={chat.busy} onApply={(g) => void chat.applyProposal(m.id, g)} />}
                {m.actions && m.actions.length > 0 && (
                  <div className="aw-acts">
                    {m.actions.map((a) => (
                      <button key={a.id} type="button" className={`aw-act is-${a.kind} ${a.used ? "is-used" : ""}`} disabled={a.used || chat.busy} onClick={() => void chat.run(m.id, a.id)}>{a.used ? `${a.label} \u2713` : a.label}</button>
                    ))}
                    {m.actions.some((a) => a.prompt) && <blockquote className="aw-prompt">{m.actions.find((a) => a.prompt)?.prompt}</blockquote>}
                  </div>
                )}
                {!chat.busy && !editing && !m.note && (m.role === "user"
                  ? <div className="aw-msg-acts"><button type="button" aria-label="Copy" title="Copy" onClick={() => void navigator.clipboard?.writeText(m.text).catch(() => {})}><Copy size={13} /></button><button type="button" aria-label="Edit and resend" title="Edit and resend" onClick={() => setEditing({ id: m.id, text: m.text })}><Pencil size={13} /></button></div>
                  : <div className="aw-msg-acts"><button type="button" aria-label="Copy" title="Copy" onClick={() => void navigator.clipboard?.writeText(m.text).catch(() => {})}><Copy size={13} /></button>{(m.error || at === lastAgent) && <button type="button" aria-label="Try again" title="Try again" onClick={() => void chat.retry(m.id)}><RotateCcw size={13} /></button>}</div>)}
              </div>
            ))}
            {chat.busy && <div className="aw-msg is-agent"><Thinking /></div>}
          </div>
          </>
          )}
          {(atts.length > 0 || uploading !== null || attErr) && (
            <div className="aw-atts">
              {atts.map((a) => (
                <span key={a.id} className="aw-att aw-att-pic" title={a.name}><Thumb kind={a.kind} id={a.id} name={a.name} /><button type="button" aria-label={`Remove ${a.name}`} onClick={() => setAtts((l) => l.filter((x) => x.id !== a.id))}><X size={11} /></button></span>
              ))}
              {docs.map((d, i) => (
                <span key={`${d.name}-${i}`} className="aw-att" title={d.name}>{d.name}<button type="button" aria-label={`Remove ${d.name}`} onClick={() => setDocs((l) => l.filter((_, j) => j !== i))}><X size={12} /></button></span>
              ))}
              {uploading !== null && <span className="aw-att"><Loader2 size={12} className="cr-spin" />{uploading > 0 && uploading < 1 ? `${Math.round(uploading * 100)}%` : "Adding…"}</span>}
              {attErr && <span className="aw-att is-error">{attErr}</span>}
            </div>
          )}
          <form className="aw-input" onSubmit={submit}>
            <input ref={fileIn} type="file" hidden multiple onChange={(e) => void addFiles(e.target.files)} />
            <button type="button" className="aw-clip" aria-label="Add a file" title="Add a file" disabled={chat.busy || atts.length + docs.length >= MAX_ATTACH} onClick={() => fileIn.current?.click()}><Plus size={15} /></button>
            <GrowArea noExpand value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={`Message ${name}…`} aria-label={`Message ${name}`} onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); submit(); } }} />
            {chat.busy
              ? <button type="button" aria-label="Stop" title="Stop" onClick={() => chat.stop()}><Square size={14} /></button>
              : <button type="submit" aria-label="Send" disabled={!draft.trim() || uploading !== null}><ArrowUp size={16} /></button>}
          </form>
        </div>
      )}
      {!open && <button ref={btn} type="button" className={`aw-btn ${dragging ? "is-drag" : ""} ${hop ? "is-hop" : ""} ${bounce ? "is-bounce" : ""}`} aria-label={`${name} agent. Drag to move, tap to talk.`} style={{ left: pos.x, top: pos.y }}
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={() => { drag.current = null; setDragging(false); }}>
        <Bot />
      </button>}
    </>
  );
}
