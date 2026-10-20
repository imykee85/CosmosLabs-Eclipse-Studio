// xAI Grok Imagine (grok-imagine-image-2.0) as the DIRECT route for Grok Image 2.0. Built from docs/image-providers/xai-imagine.md (owner's reference, 2026-10-20);
// NOT run against the live API (no key, the sandbox cannot reach it). Synchronous, one picture per request, always quality "low".
// Edits: the page documents ONE source image sent as {url, type:"image_url"} (a data URI is allowed); how several are sent is not on the page, so more than one
// reference goes to Higgsfield instead (fallback flag), and nothing is guessed.
import { ProviderError, SAY, type SyncGenerateInput, type SyncGenerateResult, type SyncImageProvider } from "./types";

export const xaiBase = () => process.env.XAI_BASE_URL ?? "https://api.x.ai";
export const XAI_MODEL = "grok-imagine-image-2.0";
const RATIOS = new Set(["1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3", "2:1", "1:2", "19.5:9", "9:19.5", "20:9", "9:20", "21:9", "5:2"]);
const MAX_PICTURE = 25 * 1024 * 1024;

export function xaiRequest(input: SyncGenerateInput): Record<string, unknown> {
  const ratio = input.aspectRatio && RATIOS.has(input.aspectRatio) ? input.aspectRatio : "auto";
  const body: Record<string, unknown> = { model: input.apiModel, prompt: input.prompt, n: 1, quality: "low", resolution: input.resolution === "2k" ? "2k" : "1k" };
  if (input.references.length === 0) body.aspect_ratio = ratio;
  else { const r = input.references[0]; body.image = { url: `data:${r.contentType.toLowerCase()};base64,${Buffer.from(r.bytes).toString("base64")}`, type: "image_url" }; }
  return body;
}

export const xai: SyncImageProvider = {
  async generate(input): Promise<SyncGenerateResult> {
    const key = process.env.XAI_API_KEY;
    if (!key) throw new ProviderError(SAY.notReady, "XAI_API_KEY is not set", true);
    if (input.references.length > 1) throw new ProviderError(SAY.failed, "the direct route sends one source picture only", true);
    const path = input.references.length ? "/v1/images/edits" : "/v1/images/generations";
    let res: Response;
    try {
      res = await fetch(`${xaiBase()}${path}`, { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify(xaiRequest(input)), signal: input.signal });
    } catch (e) {
      if (e instanceof DOMException && (e.name === "TimeoutError" || e.name === "AbortError")) throw new ProviderError(SAY.timeout, "timed out waiting for Grok Imagine", true);
      throw new ProviderError(SAY.unreachable, e instanceof Error ? e.message : "network error", true);
    }
    const text = await res.text();
    type Reply = { data?: { url?: string; b64_json?: string; mime_type?: string; respect_moderation?: boolean }[]; usage?: unknown; error?: { code?: string; message?: string } | string; code?: string };
    let json: Reply | null = null;
    try { json = JSON.parse(text); } catch {}
    const errText = typeof json?.error === "string" ? json.error : `${json?.error?.code ?? json?.code ?? ""} ${json?.error?.message ?? ""}`.trim();
    if (!res.ok || json?.error) {
      const why = `${res.status} ${errText || text.slice(0, 300)}`;
      if (/moderation|safety|policy|content/i.test(errText)) throw new ProviderError(SAY.safety, why);
      if (res.status === 429) throw new ProviderError(SAY.busy, why, true);
      if (res.status === 401 || res.status === 403) throw new ProviderError(SAY.notReady, why, true);
      if (res.status >= 500) throw new ProviderError(SAY.unreachable, why, true);
      throw new ProviderError(SAY.failed, why);
    }
    const item = json?.data?.[0];
    if (item && item.respect_moderation === false) throw new ProviderError(SAY.safety, "the image was blocked by moderation");
    if (item?.b64_json) {
      const bytes = new Uint8Array(Buffer.from(item.b64_json, "base64"));
      return { bytes, contentType: item.mime_type ?? (bytes[0] === 0xff ? "image/jpeg" : "image/png"), usage: json?.usage };
    }
    if (!item?.url) throw new ProviderError(SAY.noPicture, `no picture in the reply: ${text.slice(0, 200)}`);
    // The link is temporary, so the picture is fetched now (https only; plain http only for a test server named by XAI_BASE_URL, same host).
    const link = new URL(item.url);
    const testHost = process.env.XAI_BASE_URL ? new URL(process.env.XAI_BASE_URL).host : null;
    if (link.protocol !== "https:" && !(link.protocol === "http:" && link.host === testHost)) throw new ProviderError(SAY.failed, "the picture link is not https");
    let pic: Response;
    try { pic = await fetch(item.url, { signal: AbortSignal.timeout(30_000) }); } catch (e) { throw new ProviderError(SAY.unreachable, `could not download the picture: ${e instanceof Error ? e.message : "network error"}`); }
    if (!pic.ok) throw new ProviderError(SAY.failed, `picture download answered ${pic.status}`);
    const bytes = new Uint8Array(await pic.arrayBuffer());
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_PICTURE) throw new ProviderError(SAY.failed, `the picture is empty or too large (${bytes.byteLength} bytes)`);
    const type = (pic.headers.get("content-type") ?? "").split(";")[0];
    return { bytes, contentType: ["image/png", "image/jpeg", "image/webp"].includes(type) ? type : bytes[0] === 0xff ? "image/jpeg" : "image/png", usage: json?.usage };
  },
};
