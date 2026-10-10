// Google Nano Banana through the Gemini API (the Interactions API). Everything here is from the owner's brief (read from
// ai.google.dev/gemini-api/docs/image-generation); NOT yet run against the live API (the sandbox cannot reach it and has no key).
// Unconfirmed, so kept tolerant and marked: the exact shape of the REST reply (we look for the picture in `output_image` or in any image block
// outside the "thought" steps and take the last one), the list of aspect ratios per model, request size limits, and whether a seed exists (none is sent).
import { ProviderError, type SyncGenerateInput, type SyncGenerateResult, type SyncImageProvider } from "./types";

const base = () => process.env.GEMINI_BASE_URL ?? "https://generativelanguage.googleapis.com";
// Our tiers to the API's `image_size` (an UPPERCASE K).
const SIZES: Record<string, string> = { "1k": "1K", "2k": "2K", "4k": "4K" };
const b64 = (bytes: Uint8Array) => Buffer.from(bytes).toString("base64");

type Block = { type?: string; data?: string; mime_type?: string; text?: string; [k: string]: unknown };

// The last real picture in the reply. Interim "thought" images (up to two) are skipped.
export function findPicture(node: unknown): { data: string; mime?: string } | null {
  let found: { data: string; mime?: string } | null = null;
  const walk = (n: unknown, inThought: boolean) => {
    if (Array.isArray(n)) { for (const x of n) walk(x, inThought); return; }
    if (!n || typeof n !== "object") return;
    const o = n as Block & { output_image?: Block };
    const thought = inThought || o.type === "thought";
    if (!thought && o.type === "image" && typeof o.data === "string" && o.data.length > 40) found = { data: o.data, mime: o.mime_type };
    for (const [k, v] of Object.entries(o)) if (k !== "data" && v && typeof v === "object") walk(v, thought);
  };
  const direct = (node as { output_image?: Block } | null)?.output_image;
  walk(node, false);
  if (found) return found;
  if (direct && typeof direct.data === "string" && direct.data.length > 40) return { data: direct.data, mime: direct.mime_type };
  return null;
}

function textOf(node: unknown): string {
  const out: string[] = [];
  const walk = (n: unknown) => {
    if (Array.isArray(n)) { n.forEach(walk); return; }
    if (!n || typeof n !== "object") return;
    const o = n as Block;
    if (o.type === "text" && typeof o.text === "string") out.push(o.text);
    for (const v of Object.values(o)) if (v && typeof v === "object") walk(v);
  };
  walk(node);
  return out.join(" ").trim();
}

export function googleRequestBody(input: SyncGenerateInput): Record<string, unknown> {
  const size = input.resolution ? SIZES[input.resolution] : undefined;
  const parts = [{ type: "text", text: input.prompt }, ...input.references.map((r) => ({ type: "image", mime_type: r.contentType, data: b64(r.bytes) }))];
  return {
    model: input.apiModel,
    input: input.references.length ? parts : input.prompt,
    response_format: { type: "image", mime_type: "image/jpeg", ...(input.aspectRatio ? { aspect_ratio: input.aspectRatio } : {}), ...(size ? { image_size: size } : {}) },
  };
}

export const google: SyncImageProvider = {
  async generate(input): Promise<SyncGenerateResult> {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new ProviderError("Google image generation is not set up yet.", "GEMINI_API_KEY is not set");
    let res: Response;
    try {
      res = await fetch(`${base()}/v1beta/interactions`, { method: "POST", headers: { "x-goog-api-key": key, "Content-Type": "application/json" }, body: JSON.stringify(googleRequestBody(input)), signal: input.signal });
    } catch (e) {
      if (e instanceof DOMException && (e.name === "TimeoutError" || e.name === "AbortError")) throw new ProviderError("This render took too long and was stopped. Please try again.", "timed out waiting for Google");
      throw new ProviderError("Google could not be reached. Please try again.", e instanceof Error ? e.message : "network error");
    }
    const text = await res.text();
    let json: unknown = null;
    try { json = JSON.parse(text); } catch {}
    if (!res.ok) {
      const err = (json as { error?: { message?: string; status?: string } } | null)?.error;
      const why = err?.message ?? text.slice(0, 300);
      if (res.status === 429) throw new ProviderError("Google is limiting requests right now. Please try again in a minute.", `${res.status}: ${why}`);
      if (res.status === 401 || res.status === 403) throw new ProviderError("Google rejected our request (the key or its billing). The owner needs to check it.", `${res.status}: ${why}`);
      if (/safety|blocked|prohibited|policy/i.test(why)) throw new ProviderError("Google's safety filter blocked this image. Try a different prompt.", `${res.status}: ${why}`);
      throw new ProviderError(`Google could not make this image (${res.status}): ${why.slice(0, 220)}`, `${res.status}: ${why}`);
    }
    const pic = findPicture(json);
    if (!pic) {
      const said = textOf(json);
      throw new ProviderError(said ? "Google did not return a picture. It said: " + said.slice(0, 160) : "Google did not return a picture. It may have refused the prompt.", `no image in the reply: ${text.slice(0, 200)}`);
    }
    return { bytes: new Uint8Array(Buffer.from(pic.data, "base64")), contentType: pic.mime?.startsWith("image/") ? pic.mime : "image/jpeg", usage: (json as { usage?: unknown; usage_metadata?: unknown } | null)?.usage ?? (json as { usage_metadata?: unknown } | null)?.usage_metadata };
  },
};
