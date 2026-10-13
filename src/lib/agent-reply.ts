import type Anthropic from "@anthropic-ai/sdk";

// Turns the model's answer into what the browser shows: the text and the buttons made from its tool calls. Kept apart from the route so it can be tested.
export type Action = { kind: "generate" | "use_prompt" | "reply"; label: string; prompt?: string; count?: number };
const clip = (s: unknown, n: number) => (typeof s === "string" ? s.trim().slice(0, n) : "");
const MAX_PROMPT = 5000; // the longest prompt a box can hold

// A prompt normally arrives as text, but a structured (JSON-style) prompt can arrive as an object: keep it, written out as JSON text.
function promptText(v: unknown): string {
  if (typeof v === "string") return v.trim().slice(0, MAX_PROMPT);
  if (v && typeof v === "object") { try { return JSON.stringify(v, null, 2).slice(0, MAX_PROMPT); } catch { return ""; } }
  return "";
}

export function buildReply(content: Anthropic.ContentBlock[], stopReason: string | null | undefined): { text: string; actions: Action[] } {
  let text = "";
  const actions: Action[] = [];
  for (const b of content) {
    if (b.type === "text") text += b.text;
    else if (b.type === "tool_use") {
      const i = (b.input ?? {}) as Record<string, unknown>;
      const prompt = promptText(i.prompt);
      if (b.name === "propose_generation" && prompt) {
        const n = Number.isInteger(i.count) ? Math.min(4, Math.max(1, i.count as number)) : undefined;
        actions.push({ kind: "generate", label: n && n > 1 ? `Generate ${n}` : "Generate", prompt, count: n });
      } else if (b.name === "suggest_prompt" && prompt) actions.push({ kind: "use_prompt", label: "Use this prompt", prompt });
      else if (b.name === "ask_approval" && Array.isArray(i.options)) for (const o of i.options.slice(0, 4)) { const l = clip(o, 40); if (l) actions.push({ kind: "reply", label: l }); }
    }
  }
  text = text.trim();
  // An answer that ran out of room can lose its buttons: never leave the person looking for something that is not there.
  if (stopReason === "max_tokens" && !actions.length) text += `${text ? "\n\n" : ""}My answer was cut off before I could attach the buttons. Ask me to send it again, shorter.`;
  if (!text && !actions.length) text = "I don't have anything to add yet. Tell me a bit more.";
  return { text, actions };
}
