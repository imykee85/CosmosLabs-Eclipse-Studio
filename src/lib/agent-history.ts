import type Anthropic from "@anthropic-ai/sdk";
import { parsePictures, type PicturePick } from "@/lib/agent-pictures";
import type { PromptImage, ImageRef } from "@/lib/prompt-images";

// The chat as Atlas (or a custom agent) remembers it: each message with the pictures and videos it was shown with. The newest pictures
// of earlier messages are sent again as pictures, so the agent can compare the preview with the references it was given. Videos are
// remembered by id: the agent can watch one again with its video tool. Only what the person's own chat holds is sent.
export type Turn = { role: "user" | "assistant"; text: string; pictures: PicturePick[]; videos: { id: string; label: string; role: string }[] };

const clip = (s: unknown, n: number) => (typeof s === "string" ? s.trim().slice(0, n) : "");
const MAX_TURNS = 40;
const MAX_HISTORY_PICTURES = 8;

export function parseTurns(input: unknown): Turn[] {
  const out: Turn[] = [];
  for (const m of (Array.isArray(input) ? input.slice(-MAX_TURNS) : []) as { role?: unknown; text?: unknown; seen?: { pictures?: unknown; videos?: unknown } }[]) {
    const text = clip(m?.text, 4000);
    if (!text || (m.role !== "user" && m.role !== "agent")) continue;
    const videos = (Array.isArray(m.seen?.videos) ? m.seen!.videos as { id?: unknown; label?: unknown; role?: unknown }[] : [])
      .filter((v) => typeof v?.id === "string" && (v.id as string).length <= 64)
      .slice(0, 6)
      .map((v) => ({ id: v.id as string, label: clip(v.label, 60), role: clip(v.role, 30) }));
    out.push({ role: m.role === "user" ? "user" : "assistant", text, pictures: parsePictures(m.seen?.pictures), videos });
  }
  return out;
}

// The newest pictures from earlier messages (not the last one: its pictures come with the box as now), without repeats.
export function historyPictures(turns: Turn[]): PicturePick[] {
  const seen = new Set<string>();
  const picks: PicturePick[] = [];
  for (let i = turns.length - 2; i >= 0 && picks.length < MAX_HISTORY_PICTURES; i--) {
    for (const p of turns[i].pictures) {
      const key = `${p.type}:${p.id}`;
      if (seen.has(key) || picks.length >= MAX_HISTORY_PICTURES) continue;
      seen.add(key);
      picks.push(p);
    }
  }
  return picks;
}

// Builds the conversation the model sees. `loaded` holds the history pictures that could be read (by type:id); the last turn is left
// as text here (its pictures are attached separately, as before). Consecutive turns of one speaker are joined, as the API wants.
export function buildMessages(turns: Turn[], loaded: Map<string, PromptImage>): Anthropic.MessageParam[] {
  const out: { role: "user" | "assistant"; content: Anthropic.ContentBlockParam[] }[] = [];
  turns.forEach((t, i) => {
    const blocks: Anthropic.ContentBlockParam[] = [];
    if (i < turns.length - 1 && t.role === "user") {
      for (const p of t.pictures) {
        const img = loaded.get(`${p.type}:${p.id}`);
        if (!img) continue;
        blocks.push({ type: "text", text: `Earlier you were shown picture${p.role ? ` (${p.role})` : ""}: ${clip(img.label, 60)}` });
        blocks.push({ type: "image", source: { type: "base64", media_type: img.mediaType, data: img.data } });
      }
    }
    if (t.videos.length) blocks.push({ type: "text", text: `Videos in this message (watch one again with its clip_id if you need to compare it): ${t.videos.map((v) => `clip_id ${v.id} (${v.label}${v.role ? `, ${v.role}` : ""})`).join("; ")}` });
    blocks.push({ type: "text", text: t.text });
    const last = out[out.length - 1];
    if (last && last.role === (t.role === "user" ? "user" : "assistant")) last.content.push(...blocks);
    else out.push({ role: t.role === "user" ? "user" : "assistant", content: blocks });
  });
  while (out.length && out[0].role !== "user") out.shift();
  return out as Anthropic.MessageParam[];
}

export type { ImageRef };

// Loads the history pictures from our own storage (owner-checked, four at a time, as the loader allows). A picture that cannot be read is
// left out: the answer still goes on, and the rest of the history is kept.
export async function loadHistoryImages(
  userId: string,
  picks: PicturePick[],
  load: (userId: string, refs: ImageRef[]) => Promise<{ ok: true; images: PromptImage[] } | { ok: false; error: string }>,
): Promise<Map<string, PromptImage>> {
  const loaded = new Map<string, PromptImage>();
  for (let i = 0; i < picks.length; i += 4) {
    const chunk = picks.slice(i, i + 4);
    const r = await load(userId, chunk.map(({ type, id }) => ({ type, id })));
    if (!r.ok || r.images.length !== chunk.length) continue;
    chunk.forEach((p, j) => loaded.set(`${p.type}:${p.id}`, r.images[j]));
  }
  return loaded;
}
