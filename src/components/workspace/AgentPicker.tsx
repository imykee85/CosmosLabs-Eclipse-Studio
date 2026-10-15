"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Plus, Trash2, X } from "lucide-react";
import AgentIcon from "@/components/AgentIcon";
import { useAgent } from "@/lib/use-agent";
import { useCustomAgents } from "@/lib/custom-agents";
import { INSTRUCTIONS_MAX, NAME_MAX, ROLE_MAX } from "@/lib/user-agents";

// Atlas is the one built-in agent (user 2026-10-13); people make their own extra agents here.
export const AGENTS = ["Atlas"];
export const DEFAULT_AGENT = "Atlas";
export const AGENT_KEY = "eclipse-agent";

const ATLAS_BLURB = "Your creative partner: it brainstorms ideas, writes detailed prompts and checks your plans.";

// Pick the agent that helps in the prompt boxes (remembered in this browser), and create, or delete, your own.
export default function AgentPicker() {
  const { agent, setAgent } = useAgent();
  const { agents: mine, error, create, remove } = useCustomAgents();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [instructions, setInstructions] = useState("");
  const [busy, setBusy] = useState(false);
  const first = useRef<HTMLInputElement>(null);

  // The chip's "Create your own agent" link arrives with ?new=1.
  useEffect(() => { if (new URLSearchParams(window.location.search).get("new") === "1") setOpen(true); }, []);
  useEffect(() => { if (open) first.current?.focus(); }, [open]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const made = await create({ name, role, instructions });
    setBusy(false);
    if (made) { setAgent(made.name); setOpen(false); setName(""); setRole(""); setInstructions(""); }
  }

  const cards = [{ name: "Atlas", blurb: ATLAS_BLURB, id: "" }, ...mine.map((a) => ({ name: a.name, blurb: a.role || "Your own agent.", id: a.id }))];
  return (
    <>
      <div className="ws-kinds" role="group" aria-label="Agents">
        {cards.map((c) => {
          const on = agent === c.name;
          return (
            <div key={c.name} className="ag-wrap">
              <button type="button" className={`ws-kind ws-pick ${on ? "is-selected" : ""}`} aria-pressed={on} onClick={() => setAgent(c.name)}>
                <span className="ws-card-icon"><AgentIcon size={20} /></span>
                <h2>{c.name}</h2>
                <p>{c.blurb}</p>
                <span className="ws-pick-state">{on ? <><Check size={15} /> Selected</> : "Select"}</span>
              </button>
              {c.id && <button type="button" className="ag-del" aria-label={`Delete ${c.name}`} title={`Delete ${c.name}`} onClick={() => { if (window.confirm(`Delete the agent ${c.name}?`)) void remove(c.id); }}><Trash2 size={15} /></button>}
            </div>
          );
        })}
        <button type="button" className="ws-kind ws-pick ag-new" onClick={() => setOpen(true)}>
          <span className="ws-card-icon"><Plus size={20} /></span>
          <h2>Create your own</h2>
          <p>Name an agent, say what it is good at and how it should behave.</p>
          <span className="ws-pick-state">New agent</span>
        </button>
      </div>

      {open && (
        <div className="ag-scrim" onClick={() => setOpen(false)}>
          <form className="ag-dialog" role="dialog" aria-modal="true" aria-label="Create your own agent" onClick={(e) => e.stopPropagation()} onSubmit={save}>
            <button type="button" className="ag-x" aria-label="Close" onClick={() => setOpen(false)}><X size={18} /></button>
            <h2>Create your own agent</h2>
            <label><span>Name</span><input ref={first} value={name} maxLength={NAME_MAX} onChange={(e) => setName(e.target.value)} placeholder="For example Nova" required /></label>
            <label><span>What is it good at?</span><input value={role} maxLength={ROLE_MAX} onChange={(e) => setRole(e.target.value)} placeholder="For example fashion lookbooks" /></label>
            <label><span>How should it behave?</span><textarea value={instructions} maxLength={INSTRUCTIONS_MAX} rows={5} onChange={(e) => setInstructions(e.target.value)} placeholder="Tone, focus, what to ask first, what to avoid…" required /></label>
            <p className="ag-note">Your agent follows these notes inside Eclipse&rsquo;s rules: it can only propose, and nothing is made or charged until you press a button. You can have up to 5.</p>
            {error && <p className="ag-err" role="alert">{error}</p>}
            <button type="submit" className="ag-save" disabled={busy || name.trim().length < 2 || instructions.trim().length < 10}>{busy ? "Saving…" : "Save agent"}</button>
          </form>
        </div>
      )}
    </>
  );
}
