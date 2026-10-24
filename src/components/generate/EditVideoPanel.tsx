"use client";

import { useMemo, useState } from "react";
import { PRESETS, findPreset, FEATURE_NAME } from "@/lib/video-edit/prompts";
import "./edit-video.css";

// Eclipse Edit inside Video Studio: change what is in the chosen video (swap, recast, new place, restyle) and keep its performance.
// Sends the choice to /api/video/alter, which builds the prompt from the tested presets and starts a draft (or a final) run.
export default function EditVideoPanel({ sourceId, sourceLabel, pictureIds, onStarted, onClose }: {
  sourceId: string; sourceLabel: string; pictureIds: string[]; onStarted: (id: string) => void; onClose: () => void;
}) {
  const groups = useMemo(() => {
    const map = new Map<string, typeof PRESETS>();
    for (const p of PRESETS) map.set(p.group, [...(map.get(p.group) ?? []), p]);
    return [...map.entries()];
  }, []);
  const [preset, setPreset] = useState(PRESETS[0].name);
  const [who, setWho] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [extra, setExtra] = useState("");
  const [final, setFinal] = useState(false);
  const [sound, setSound] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const current = findPreset(preset);
  const slots = Object.keys(current?.fill ?? {});

  async function start() {
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/video/alter", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preset, who, values, extra, sourceVideoId: sourceId, imageIds: pictureIds.slice(0, 1), resolution: final ? "1080p" : "480p", newAudio: sound }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error ?? "Could not start the edit. Please try again."); return; }
      onStarted(data.id);
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="cr-edit" aria-label={FEATURE_NAME}>
      <header>
        <strong>{FEATURE_NAME}</strong> <span>{sourceLabel}</span>
        <button type="button" aria-label="Close" onClick={onClose}>×</button>
      </header>
      <label>Edit
        <select value={preset} onChange={(e) => { setPreset(e.target.value); setValues({}); }}>
          {groups.map(([g, list]) => (
            <optgroup key={g} label={g}>{list.map((p) => <option key={p.name} value={p.name}>{p.name}</option>)}</optgroup>
          ))}
        </select>
      </label>
      <label>Who or what is in the video
        <input value={who} maxLength={300} placeholder="e.g. the man with dark curly hair" onChange={(e) => setWho(e.target.value)} />
      </label>
      {slots.map((k) => (
        <label key={k}>{k}
          <input value={values[k] ?? ""} maxLength={600} placeholder={current?.fill?.[k]} onChange={(e) => setValues({ ...values, [k]: e.target.value })} />
        </label>
      ))}
      <label>One more sentence (optional)
        <input value={extra} maxLength={600} onChange={(e) => setExtra(e.target.value)} />
      </label>
      <div className="cr-edit-row">
        <button type="button" aria-pressed={!final} onClick={() => setFinal(false)}>Draft 480p</button>
        <button type="button" aria-pressed={final} onClick={() => setFinal(true)}>Final 1080p</button>
        <button type="button" aria-pressed={sound} onClick={() => setSound((v) => !v)}>New sound {sound ? "on" : "off"}</button>
      </div>
      {error && <p role="alert" className="cr-edit-error">{error}</p>}
      <button type="button" className="cr-edit-start" disabled={busy || !who.trim()} onClick={start}>{busy ? "Starting…" : "Start edit"}</button>
    </section>
  );
}
