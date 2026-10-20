// Qwen Image through Alibaba Cloud Model Studio (DashScope), SINGAPORE region. Built from the owner's reference file docs/image-providers/qwen-image.md
// (copied from the official pages 2026-10-20) and NOT yet run against the live API: the sandbox cannot reach it and has no key.
// Synchronous call, one picture per request. The result is a PNG link that lasts 24 hours, so it is downloaded at once. No seed, no negative prompt, no thinking.
import { arkSize } from "./byteplus";
import { ProviderError, SAY, type SizeRule, type SyncGenerateInput, type SyncGenerateResult, type SyncImageProvider } from "./types";

// Host: the workspace form when DASHSCOPE_WORKSPACE_ID is set, else the older international domain that the page says still works for Singapore.
// DASHSCOPE_BASE_URL replaces both (tests).
export const qwenBase = () => process.env.DASHSCOPE_BASE_URL ?? (process.env.DASHSCOPE_WORKSPACE_ID ? `https://${process.env.DASHSCOPE_WORKSPACE_ID}.ap-southeast-1.maas.aliyuncs.com` : "https://dashscope-intl.aliyuncs.com");
/** The model id the direct route sends. The page lists qwen-image-3.0 (cheaper) and qwen-image-3.0-pro; the owner has not said which, so it is a Config value. */
export const qwenModel = () => process.env.QWEN_IMAGE_MODEL?.trim() || "qwen-image-3.0";

// Output area must be 512*512 to 2048*2048 pixels. 1k is about 1,048,576 pixels; 2k is about 4,000,000 (just under the limit and above the 2,250,000 billing line).
// Multiples of 16 are Eclipse's own safe choice (the page does not say). Ratio limits (1:8 to 8:1) are never reached by our ratio list.
export const QWEN_SIZE_RULE: SizeRule = { px: { "1k": 1_048_576, "2k": 4_000_000 }, min: 512 * 512, max: 2048 * 2048 };
export const qwenSize = (ratio: string | undefined, tier: string | undefined) => arkSize(ratio, tier ?? "1k", QWEN_SIZE_RULE).replace("x", "*"); // DashScope writes WIDTH*HEIGHT

type Part = { text: string } | { image: string };
export function qwenRequest(input: SyncGenerateInput): Record<string, unknown> {
  const content: Part[] = [
    ...input.references.map((r) => ({ image: `data:${r.contentType.toLowerCase()};base64,${Buffer.from(r.bytes).toString("base64")}` })), // edit: pictures first, then ONE text
    { text: input.prompt },
  ];
  return {
    model: input.apiModel,
    input: { messages: [{ role: "user", content }] },
    parameters: { n: 1, size: qwenSize(input.aspectRatio, input.resolution), prompt_extend: false, watermark: false },
  };
}

const MAX_PICTURE = 25 * 1024 * 1024;

export const qwen: SyncImageProvider = {
  async generate(input): Promise<SyncGenerateResult> {
    const key = process.env.DASHSCOPE_API_KEY;
    if (!key) throw new ProviderError(SAY.notReady, "DASHSCOPE_API_KEY is not set", true);
    let res: Response;
    try {
      res = await fetch(`${qwenBase()}/api/v1/services/aigc/multimodal-generation/generation`, { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify(qwenRequest(input)), signal: input.signal });
    } catch (e) {
      if (e instanceof DOMException && (e.name === "TimeoutError" || e.name === "AbortError")) throw new ProviderError(SAY.timeout, "timed out waiting for Qwen Image", true);
      throw new ProviderError(SAY.unreachable, e instanceof Error ? e.message : "network error", true);
    }
    const text = await res.text();
    let json: { code?: string; message?: string; output?: { choices?: { message?: { content?: { image?: string }[] } }[] }; usage?: unknown } | null = null;
    try { json = JSON.parse(text); } catch {}
    if (!res.ok || json?.code) {
      const code = json?.code ?? "";
      const why = `${res.status} ${code}: ${json?.message ?? text.slice(0, 300)}`;
      if (/DataInspection|inappropriate|safety|moderation|sensitive|violat/i.test(code + " " + (json?.message ?? ""))) throw new ProviderError(SAY.safety, why);
      if (res.status === 429 || /Throttling|RateQuota|Limit/i.test(code)) throw new ProviderError(SAY.busy, why, true);
      if (res.status === 401 || res.status === 403 || /InvalidApiKey|AccessDenied|Unauthorized/i.test(code)) throw new ProviderError(SAY.notReady, why, true);
      if (res.status >= 500) throw new ProviderError(SAY.unreachable, why, true);
      throw new ProviderError(SAY.failed, why);
    }
    const url = json?.output?.choices?.[0]?.message?.content?.find((c) => typeof c.image === "string")?.image;
    if (!url) throw new ProviderError(SAY.noPicture, `no image link in the reply: ${text.slice(0, 200)}`);
    // The link lasts 24 hours, so the picture is fetched now (https only, size and time capped).
    // https only; plain http is allowed solely for a test server named by DASHSCOPE_BASE_URL, on that same host.
    const link = new URL(url);
    const testHost = process.env.DASHSCOPE_BASE_URL ? new URL(process.env.DASHSCOPE_BASE_URL).host : null;
    if (link.protocol !== "https:" && !(link.protocol === "http:" && link.host === testHost)) throw new ProviderError(SAY.failed, "the picture link is not https");
    let pic: Response;
    try { pic = await fetch(url, { signal: AbortSignal.timeout(30_000) }); } catch (e) { throw new ProviderError(SAY.unreachable, `could not download the picture: ${e instanceof Error ? e.message : "network error"}`); }
    if (!pic.ok) throw new ProviderError(SAY.failed, `picture download answered ${pic.status}`);
    const bytes = new Uint8Array(await pic.arrayBuffer());
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_PICTURE) throw new ProviderError(SAY.failed, `the picture is empty or too large (${bytes.byteLength} bytes)`);
    return { bytes, contentType: bytes[0] === 0x89 && bytes[1] === 0x50 ? "image/png" : bytes[0] === 0xff ? "image/jpeg" : "image/png", usage: json?.usage };
  },
};
