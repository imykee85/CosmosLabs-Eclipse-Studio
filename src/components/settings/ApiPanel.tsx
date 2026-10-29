"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Copy, KeyRound, Loader2, Plus, Trash2 } from "lucide-react";

type Key = { id: string; name: string; prefix: string; createdAt: string; lastUsedAt: string | null };
type App = { id: string; name: string; connectedAt: string; lastUsedAt: string | null };

// API keys and the MCP endpoint: make a key (its full value is shown once), see and revoke the live ones, and copy the commands that
// connect an MCP client and the REST API. Everything acts as this account and spends its regular credits.
function CodeBlock({ id, text }: { id: string; text: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try { await navigator.clipboard.writeText(text); setCopied(true); window.setTimeout(() => setCopied(false), 1800); } catch {
      const el = document.getElementById(id);
      if (el) { const r = document.createRange(); r.selectNodeContents(el); const s = window.getSelection(); s?.removeAllRanges(); s?.addRange(r); }
    }
  }
  return (
    <div className="st-code">
      <pre id={id}>{text}</pre>
      <button type="button" className="st-copy" onClick={copy} aria-label="Copy">{copied ? <Check size={16} /> : <Copy size={16} />}</button>
    </div>
  );
}

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "never");

export default function ApiPanel() {
  const [origin, setOrigin] = useState("https://your-site.com");
  const [keys, setKeys] = useState<Key[] | null>(null);
  const [name, setName] = useState("");
  const [fresh, setFresh] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState<string | null>(null);
  useEffect(() => setOrigin(window.location.origin), []);
  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/keys", { cache: "no-store" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setError(typeof d.error === "string" ? d.error : r.status === 503 ? "API keys need an account (preview mode has none)." : "Could not load your keys."); setKeys([]); return; }
      setKeys(Array.isArray(d.keys) ? d.keys : []);
    } catch { setError("Could not load your keys."); setKeys([]); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  // Apps connected through "Sign in with Eclipse" (Claude's connectors): listed here and disconnected here.
  const [apps, setApps] = useState<App[] | null>(null);
  const [appConfirm, setAppConfirm] = useState<string | null>(null);
  const loadApps = useCallback(async () => {
    try {
      const r = await fetch("/api/oauth/grants", { cache: "no-store" });
      const d = await r.json().catch(() => ({}));
      setApps(r.ok && Array.isArray(d.apps) ? d.apps : []);
    } catch { setApps([]); }
  }, []);
  useEffect(() => { void loadApps(); }, [loadApps]);
  async function disconnect(id: string) {
    setAppConfirm(null);
    const r = await fetch(`/api/oauth/grants/${id}`, { method: "DELETE" });
    if (!r.ok) setError("Could not disconnect that app.");
    await loadApps();
  }

  async function create() {
    if (busy) return;
    setBusy(true); setError(""); setFresh(null);
    try {
      const r = await fetch("/api/keys", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: name.trim() || "My key" }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setError(typeof d.error === "string" ? d.error : "Could not create a key."); return; }
      setFresh(d.key); setName(""); await load();
    } finally { setBusy(false); }
  }
  async function revoke(id: string) {
    setConfirming(null);
    const r = await fetch(`/api/keys/${id}`, { method: "DELETE" });
    if (!r.ok) setError("Could not revoke that key.");
    await load();
  }

  const key = fresh ?? "YOUR_KEY";
  const claude = `claude mcp add --transport http eclipse ${origin}/api/mcp \\\n  --header "Authorization: Bearer ${key}"`;
  const json = JSON.stringify({ mcpServers: { eclipse: { type: "http", url: `${origin}/api/mcp`, headers: { Authorization: `Bearer ${key}` } } } }, null, 2);
  const curl = `curl ${origin}/api/v1/images \\\n  -H "Authorization: Bearer ${key}" \\\n  -H "Content-Type: application/json" \\\n  -d '{"prompt":"a red sneaker on wet asphalt at dusk","model":"soul_v2","aspect_ratio":"4:5"}'\n\ncurl ${origin}/api/v1/renders/RENDER_ID -H "Authorization: Bearer ${key}"`;

  return (
    <section className="st-section" aria-labelledby="st-api">
      <h2 id="st-api">API keys · MCP</h2>
      <p className="st-sub">Connect Eclipse to your AI tools, Cursor or any MCP client, or call it from your own code. Keys act as your account and spend your regular credits.</p>

      <div className="st-keyform">
        <input className="st-input" value={name} maxLength={60} placeholder="Key name, for example Laptop" aria-label="Key name" onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void create(); }} />
        <button type="button" className="st-ghost" onClick={() => void create()} disabled={busy}>{busy ? <Loader2 size={15} className="st-spin" /> : <Plus size={15} />} Create key</button>
      </div>
      {fresh && (
        <div className="st-fresh" role="status">
          <b>Copy your key now. It is shown only once.</b>
          <CodeBlock id="st-fresh" text={fresh} />
        </div>
      )}
      {error && <p className="st-note is-err" role="alert">{error}</p>}
      {keys === null ? <p className="st-meta st-keys">Loading…</p> : keys.length === 0 ? <p className="st-meta st-keys">No active keys yet.</p> : (
        <ul className="st-keylist">
          {keys.map((k) => (
            <li key={k.id}>
              <KeyRound size={16} aria-hidden="true" />
              <span><b>{k.name}</b><small>{k.prefix}… · made {when(k.createdAt)} · last used {when(k.lastUsedAt)}</small></span>
              {confirming === k.id
                ? <button type="button" className="st-ghost st-danger" onClick={() => void revoke(k.id)}>Revoke</button>
                : <button type="button" className="st-iconbtn" aria-label={`Revoke ${k.name}`} title="Revoke" onClick={() => setConfirming(k.id)}><Trash2 size={15} /></button>}
            </li>
          ))}
        </ul>
      )}

      <h3 className="st-h3 st-gap">Connect from Claude</h3>
      <p className="st-hint">In Claude, open Settings, Connectors, add a custom connector, and enter {origin}/api/mcp. Claude asks you to sign in to Eclipse and allow it. No key is needed. This works in the Claude apps on your phone too, once you have added it.</p>
      {apps && apps.length > 0 && (
        <ul className="st-keylist">
          {apps.map((a) => (
            <li key={a.id}>
              <KeyRound size={16} aria-hidden="true" />
              <span><b>{a.name}</b><small>Connected {when(a.connectedAt)} · last used {when(a.lastUsedAt)}</small></span>
              {appConfirm === a.id
                ? <button type="button" className="st-ghost st-danger" onClick={() => void disconnect(a.id)}>Disconnect</button>
                : <button type="button" className="st-iconbtn" aria-label={`Disconnect ${a.name}`} title="Disconnect" onClick={() => setAppConfirm(a.id)}><Trash2 size={15} /></button>}
            </li>
          ))}
        </ul>
      )}
      <h3 className="st-h3 st-gap">Connect from the command line</h3>
      <CodeBlock id="st-code" text={claude} />
      <h3 className="st-h3 st-gap">Other MCP clients</h3>
      <CodeBlock id="st-json" text={json} />
      <p className="st-hint">Streamable HTTP at {origin}/api/mcp. Tools: list_models, generate_image, generate_video, get_render, list_renders, get_credits, ask_atlas, ask_core. Atlas and Core need the Growth plan. Commands: image, video, atlas, storyboard, core, balance (in Claude Code they are /mcp__eclipse__image and so on).</p>
      <h3 className="st-h3 st-gap">REST API</h3>
      <CodeBlock id="st-curl" text={curl} />
      <p className="st-hint">GET /api/v1/models, POST /api/v1/images, POST /api/v1/videos, GET /api/v1/renders, GET /api/v1/renders/&lt;id&gt;, GET /api/v1/credits. Up to 60 requests a minute per key.</p>
    </section>
  );
}
