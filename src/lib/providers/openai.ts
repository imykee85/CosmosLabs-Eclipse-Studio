// OpenAI GPT Image. From the owner's brief (developers.openai.com/api/reference/resources/images, methods generate and edit); NOT yet run against the
// live API. Text only: POST /images/generations. With reference pictures: POST /images/edits (JSON body, `images` as base64 data URLs).
// GPT image models answer with `b64_json` (a `url` is not supported). No seed. Whether the newest models need organisation verification is unconfirmed.
import { createHash } from "node:crypto";
import { ProviderError, type SyncGenerateInput, type SyncGenerateResult, type SyncImageProvider } from "./types";

const base = () => process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1";
const QUALITY = "medium"; // low | medium | high | auto (2.5 models also xhigh and max). Medium until real costs are measured.
const LONG_EDGE: Record<string, number> = { "1k": 1024, "2k": 2048 }; // above 2560x1440 is experimental, so no 4K tier

const round16 = (n: number) => Math.max(16, Math.round(n / 16) * 16);

// gpt-image-2 family: any WIDTHxHEIGHT (each divisible by 16, aspect between 1:3 and 3:1, at most 3840x2160). The others: three fixed sizes.
export function openaiSize(ratio: string | undefined, tier: string | undefined, sizing: "custom16" | "fixed3" | undefined): string {
  const [w, h] = (ratio ?? "1:1").split(":").map(Number);
  if (sizing !== "custom16") return w === h ? "1024x1024" : w > h ? "1536x1024" : "1024x1536";
  const long = LONG_EDGE[tier ?? "1k"] ?? 1024;
  const aspect = Math.min(3, Math.max(1 / 3, w / h));
  return aspect >= 1 ? `${round16(long)}x${round16(long / aspect)}` : `${round16(long * aspect)}x${round16(long)}`;
}

// An opaque id for OpenAI's abuse monitoring: never the real user id.
export const openaiUser = (userId: string) => "u_" + createHash("sha256").update(userId).digest("hex").slice(0, 24);

export function openaiRequest(input: SyncGenerateInput): { path: string; body: Record<string, unknown> } {
  const common = { model: input.apiModel, prompt: input.prompt, n: 1, size: openaiSize(input.aspectRatio, input.resolution, input.sizing), quality: QUALITY, output_format: "png", ...(input.user ? { user: input.user } : {}) };
  if (input.references.length === 0) return { path: "/images/generations", body: common };
  return { path: "/images/edits", body: { ...common, images: input.references.map((r) => ({ image_url: `data:${r.contentType};base64,${Buffer.from(r.bytes).toString("base64")}` })) } };
}

export const openai: SyncImageProvider = {
  async generate(input): Promise<SyncGenerateResult> {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new ProviderError("OpenAI image generation is not set up yet.", "OPENAI_API_KEY is not set");
    const { path, body } = openaiRequest(input);
    let res: Response;
    try {
      res = await fetch(`${base()}${path}`, { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify(body), signal: input.signal });
    } catch (e) {
      if (e instanceof DOMException && (e.name === "TimeoutError" || e.name === "AbortError")) throw new ProviderError("This render took too long and was stopped. Please try again.", "timed out waiting for OpenAI");
      throw new ProviderError("OpenAI could not be reached. Please try again.", e instanceof Error ? e.message : "network error");
    }
    const text = await res.text();
    let json: { data?: { b64_json?: string }[]; output_format?: string; usage?: unknown; error?: { message?: string; code?: string; type?: string } } | null = null;
    try { json = JSON.parse(text); } catch {}
    if (!res.ok) {
      const why = json?.error?.message ?? text.slice(0, 300);
      const code = json?.error?.code ?? "";
      if (/moderation|content_policy|safety/i.test(code + " " + why)) throw new ProviderError("OpenAI's safety filter blocked this image. Try a different prompt.", `${res.status} ${code}: ${why}`);
      if (res.status === 429) throw new ProviderError("OpenAI is limiting requests right now (or the account is out of credit). Please try again in a minute.", `${res.status} ${code}: ${why}`);
      if (res.status === 401) throw new ProviderError("OpenAI rejected our key. The owner needs to check it.", `${res.status}: ${why}`);
      if (res.status === 403 || /verif/i.test(why)) throw new ProviderError("OpenAI will not run this model for our account yet (it may need the organization verified). The owner needs to check it.", `${res.status} ${code}: ${why}`);
      throw new ProviderError("OpenAI could not make this image. Please try again.", `${res.status} ${code}: ${why}`);
    }
    const b64 = json?.data?.[0]?.b64_json;
    if (!b64) throw new ProviderError("OpenAI did not return a picture.", `no b64_json in the reply: ${text.slice(0, 200)}`);
    const fmt = json?.output_format ?? "png";
    return { bytes: new Uint8Array(Buffer.from(b64, "base64")), contentType: fmt === "jpeg" ? "image/jpeg" : fmt === "webp" ? "image/webp" : "image/png", usage: json?.usage };
  },
};
