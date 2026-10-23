import type Anthropic from "@anthropic-ai/sdk";
import type { ImageRef, PromptImage } from "@/lib/prompt-images";

// The pictures attached to a prompt box, shown to the agent with the user's latest message. The browser sends ids only (never addresses); `load` reads them
// from our own storage, owner-checked. Up to 4 pictures, each introduced by a line naming its role (start frame, ingredient 2, ...).
export type PicturePick = { type: "upload" | "render"; id: string; role: string };
type Loader = (refs: ImageRef[]) => Promise<{ ok: true; images: PromptImage[] } | { ok: false; error: string }>;
const clip = (s: unknown, n: number) => (typeof s === "string" ? s.trim().slice(0, n) : "");

export function parsePictures(input: unknown): PicturePick[] {
  const seen = new Set<string>();
  const out: PicturePick[] = [];
  for (const p of (Array.isArray(input) ? input : []) as { type?: unknown; id?: unknown; role?: unknown }[]) {
    if ((p?.type !== "upload" && p?.type !== "render") || typeof p.id !== "string" || !p.id || p.id.length > 64 || seen.has(`${p.type}:${p.id}`)) continue;
    seen.add(`${p.type}:${p.id}`);
    out.push({ type: p.type, id: p.id, role: clip(p.role, 40) });
    if (out.length >= 4) break;
  }
  return out;
}

// Turns the last (user) message into text plus pictures. Returns the sentence for the agent's studio notes.
export async function attachPictures(userId: string, picks: PicturePick[], last: Anthropic.MessageParam, load: (userId: string, refs: ImageRef[]) => ReturnType<Loader>): Promise<string> {
  if (!picks.length) return "";
  const loaded = await load(userId, picks.map(({ type, id }) => ({ type, id })));
  if (!loaded.ok) return `\nThe ${picks.length} picture${picks.length > 1 ? "s" : ""} attached to the box could not be loaded this time, so you cannot see them. The reason: ${loaded.error} Tell the user that reason plainly and do not guess what the pictures show.`;
  const blocks: Anthropic.ContentBlockParam[] = [];
  loaded.images.forEach((img, i) => {
    blocks.push({ type: "text", text: `Picture ${i + 1}${picks[i].role ? ` (${picks[i].role})` : ""}: ${clip(img.label, 60)}` });
    blocks.push({ type: "image", source: { type: "base64", media_type: img.mediaType, data: img.data } });
  });
  // The message's own text stays after its pictures (it may already hold earlier turns' blocks, which stay in front).
  const own = Array.isArray(last.content) ? last.content : [{ type: "text" as const, text: typeof last.content === "string" ? last.content : "" }];
  last.content = [...own.slice(0, -1), ...blocks, own[own.length - 1]];
  return `\nYou can see the ${picks.length} picture${picks.length > 1 ? "s" : ""} attached to the box, shown with the user's latest message.`;
}
