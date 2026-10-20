// Prompt caching and history trimming for the chat loops (master brief section 8, fixes 2 and 3). Pure functions: they return copies and never touch the stored chat.
// A cache breakpoint on the last block of the system prompt caches the tool list and the system together; a second one on the last block of the last message
// is moved forward on every step, so the growing history is read from the cache instead of being paid for again.

type Block = { type: string; [k: string]: unknown };
export type Msg = { role: string; content: string | Block[] };
type AnyMsg = { role: string; content: unknown };

export const CACHE = { type: "ephemeral" } as const;

/** The system prompt as blocks: the stable part (cached together with the tools) and an optional changing part that is not cached. */
export function cachedSystem(stable: string, changing?: string): { type: "text"; text: string; cache_control?: typeof CACHE }[] {
  return changing ? [{ type: "text", text: stable, cache_control: CACHE }, { type: "text", text: changing }] : [{ type: "text", text: stable, cache_control: CACHE }];
}

/** A copy of the messages with a cache breakpoint on the last block of the last message. */
export function cacheLast<T extends AnyMsg>(messages: T[]): T[] {
  if (!messages.length) return messages;
  const out = messages.slice();
  const m = out[out.length - 1];
  const blocks: Block[] = typeof m.content === "string" ? [{ type: "text", text: m.content }] : (m.content as Block[]).map((b) => ({ ...b }));
  if (!blocks.length) return messages;
  blocks[blocks.length - 1] = { ...blocks[blocks.length - 1], cache_control: CACHE };
  out[out.length - 1] = { ...m, content: blocks } as T;
  return out;
}

const isHumanTurn = (m: AnyMsg) => m.role === "user" && (typeof m.content === "string" || (m.content as Block[]).some((b) => b.type !== "tool_result"));
export const OLD_RESULT_LIMIT = 4000;
export const OLD_RESULT_KEEP = 500;

function shortenBlock(b: Block): Block {
  if (b.type === "image") return { type: "text", text: "[picture omitted]" };
  if (b.type === "tool_result") {
    const c = b.content;
    if (typeof c === "string") return c.length > OLD_RESULT_LIMIT ? { ...b, content: `${c.slice(0, OLD_RESULT_KEEP)} [shortened]` } : b;
    if (Array.isArray(c)) {
      const inner = (c as Block[]).map((x) => (x.type === "image" ? { type: "text", text: "[picture omitted]" } : x.type === "text" && typeof x.text === "string" && x.text.length > OLD_RESULT_LIMIT ? { ...x, text: `${x.text.slice(0, OLD_RESULT_KEEP)} [shortened]` } : x));
      return { ...b, content: inner };
    }
  }
  return b;
}

/** What is sent to the model: pictures and big tool results from before the last two user turns are shortened. The last two turns are never touched. */
export function trimHistory<T extends AnyMsg>(messages: T[]): T[] {
  const turns: number[] = [];
  messages.forEach((m, i) => { if (isHumanTurn(m)) turns.push(i); });
  if (turns.length <= 2) return messages;
  const cutoff = turns[turns.length - 2];
  return messages.map((m, i) => (i >= cutoff || typeof m.content === "string" ? m : ({ ...m, content: (m.content as Block[]).map(shortenBlock) } as T)));
}
