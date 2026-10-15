"use client";

import { useCallback, useEffect, useState } from "react";
import { BadgeCheck, Download, Globe, Play, Square } from "lucide-react";
import SoonTag from "@/components/SoonTag";

const SKILL_ID = "design-taste-frontend";
type Estimate = { plan: number; build: number; reviewEach: number; max: number; creditsOn: boolean; minutes: string };
type Run = { id: string; status: string; step: string; creditsCharged: number; creditCap: number; note: string | null; credits: string | null; hasResult: boolean };
type Info = { available: boolean; enabled: boolean; estimate: Estimate; runs: Run[] };
const STEPS: { id: string; label: string }[] = [
  { id: "plan", label: "Brief and direction" }, { id: "build", label: "Idea and build" },
  { id: "review1", label: "Review round 1" }, { id: "review2", label: "Review round 2" }, { id: "review3", label: "Review round 3" },
];

// Core's Skills panel row for the built-in website design skill: switch, cost note, Start (with the cost confirmed first), and the run view.
export default function TasteSkillRow() {
  const [info, setInfo] = useState<Info | null>(null);
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const r = await fetch("/api/core/sandbox-runs", { cache: "no-store" }).catch(() => null);
    if (r?.ok) setInfo(await r.json());
  }, []);
  useEffect(() => { load(); }, [load]);
  const active = info?.runs.find((r) => r.status === "starting" || r.status === "running" || r.status === "finishing");
  useEffect(() => {
    if (!active) return;
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [active, load]);

  async function toggle() {
    if (!info) return;
    const enabled = !info.enabled;
    setInfo({ ...info, enabled });
    const r = await fetch("/api/core/sandbox-runs", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ skillId: SKILL_ID, enabled }) });
    if (!r.ok) setInfo((i) => (i ? { ...i, enabled: !enabled } : i));
  }
  async function start() {
    setBusy(true); setError("");
    const r = await fetch("/api/core/sandbox-runs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ skillId: SKILL_ID, confirm: true }) });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setError(d.error ?? "Could not start."); setAsking(false); return; }
    setAsking(false);
    await load();
  }
  async function stop(id: string) {
    setBusy(true);
    await fetch(`/api/core/sandbox-runs/${id}`, { method: "POST" });
    setBusy(false);
    await load();
  }
  async function download(id: string) {
    const r = await fetch(`/api/core/sandbox-runs/${id}`);
    const d = await r.json().catch(() => ({}));
    if (r.ok && d.url) window.location.href = d.url;
  }

  const est = info?.estimate;
  const last = info?.runs[0];
  const stepIndex = active ? STEPS.findIndex((s) => s.id === active.step) : -1;

  return (
    <section className="sk-built" aria-label="Built-in skill: website design">
      <div className="sk-built-head">
        <span className="sk-ico"><Globe size={18} /></span>
        <span className="sk-name">
          <b>Taste Skill: website design <span className="sk-badge"><BadgeCheck size={14} /> Built in</span>{info && !info.available && <SoonTag />}</b>
          <small>Builds landing pages, portfolios and one-pagers that do not look generic. Uses a sandbox, higher cost.</small>
          <small className="sk-source">Source: github.com/Leonxlnx/taste-skill, MIT license.</small>
        </span>
        <button type="button" role="switch" aria-checked={info?.enabled ?? true} aria-label="Taste Skill on or off" className={`sk-switch ${(info?.enabled ?? true) ? "is-on" : ""}`} onClick={toggle} disabled={!info}><i /></button>
        <button type="button" className="cn-btn is-red" disabled={!info || !info.enabled || Boolean(active) || busy} onClick={() => { setError(""); setAsking(true); }}><Play size={14} /> Start a build</button>
      </div>
      {error && <p className="cn-err" role="alert">{error}</p>}

      {active && (
        <div className="sk-run" aria-live="polite">
          <ol>
            {STEPS.map((s, i) => <li key={s.id} className={i < stepIndex ? "is-done" : i === stepIndex ? "is-now" : ""}>{s.label}</li>)}
          </ol>
          <p>{active.creditsCharged ? `${active.creditsCharged} credits used so far.` : "Working."}</p>
          <button type="button" className="cn-btn" disabled={busy} onClick={() => stop(active.id)}><Square size={14} /> Stop</button>
        </div>
      )}
      {!active && last && last.status !== "failed" && (
        <div className="sk-run">
          <p>{last.status === "done" ? "Your last build finished." : "Your last build was stopped."}{last.creditsCharged ? ` ${last.creditsCharged} credits used.` : ""}{last.note ? ` ${last.note}` : ""}</p>
          {last.hasResult && <button type="button" className="cn-btn" onClick={() => download(last.id)}><Download size={14} /> Download the site</button>}
          {last.credits && <details><summary>Picture credits</summary><pre>{last.credits}</pre></details>}
        </div>
      )}

      {asking && est && (
        <div className="cn-modal-scrim" onMouseDown={(e) => e.target === e.currentTarget && setAsking(false)}>
          <div className="cn-modal" role="dialog" aria-label="Start a build">
            <h2>Start a website build?</h2>
            <p>A full build takes about {est.minutes} minutes and runs in the background.{est.creditsOn ? ` It can use up to ${est.max} credits, charged step by step: ${est.plan} to start, ${est.build} for the build and ${est.reviewEach} for each review round.` : ""}</p>
            <div className="cn-actions">
              <button type="button" className="cn-btn" onClick={() => setAsking(false)}>Cancel</button>
              <button type="button" className="cn-btn is-red" disabled={busy} onClick={start}>{est.creditsOn ? `Continue, up to ${est.max} credits` : "Continue"}</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
