"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Plus } from "lucide-react";

// The MCP endpoint and key creation are not built yet; this is the finished layout.
export default function ApiPanel() {
  const [origin, setOrigin] = useState("https://your-site.com");
  const [copied, setCopied] = useState(false);

  useEffect(() => setOrigin(window.location.origin), []);

  const command = `claude mcp add --transport http eclipse ${origin}/api/mcp \\\n  --header "Authorization: Bearer YOUR_KEY"`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard can be refused in some browsers: select the text so it can be copied by hand.
      const el = document.getElementById("st-code");
      if (el) {
        const r = document.createRange();
        r.selectNodeContents(el);
        const s = window.getSelection();
        s?.removeAllRanges();
        s?.addRange(r);
      }
    }
  }

  return (
    <section className="st-section" aria-labelledby="st-api">
      <h2 id="st-api">API keys · MCP</h2>
      <p className="st-sub">
        Connect Eclipse to Claude, Cursor or any MCP client and generate premium images straight from your AI chat.
        Renders spend your regular credits.
      </p>

      <p className="st-meta st-keys">No active keys yet.</p>
      <button type="button" className="st-ghost"><Plus size={15} /> Create key</button>

      <h3 className="st-h3 st-gap">Connect to Claude</h3>
      <div className="st-code">
        <pre id="st-code">{command}</pre>
        <button type="button" className="st-copy" onClick={copy} aria-label="Copy command">
          {copied ? <Check size={16} /> : <Copy size={16} />}
        </button>
      </div>
      <span className="sr-live" role="status">{copied ? "Copied to clipboard" : ""}</span>
      <p className="st-hint">
        Works with any MCP client over Streamable HTTP. Planned tools: generate_image, get_generation, list_generations, get_credits.
        The endpoint isn&apos;t live yet, so this command won&apos;t work until it launches.
      </p>
    </section>
  );
}
