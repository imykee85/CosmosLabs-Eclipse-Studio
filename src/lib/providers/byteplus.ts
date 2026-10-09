// BytePlus ModelArk (Seedream). From the owner's brief, read from the official "Image generation API" page; NOT yet run against the live API
// (the sandbox cannot reach it and has no key). Unconfirmed: the auth header (ModelArk's standard `Authorization: Bearer` is used), the real model ids
// (the registry ids come from a third party; ARK_MODEL_<ID> overrides them) and the size tables other than the one example on the page.
// Synchronous: one call returns the picture (we ask for `b64_json`, so there is no 24-hour link to download). NO seed. Watermark is switched off explicitly.
import { ProviderError, type SizeRule, type SyncGenerateInput, type SyncGenerateResult, type SyncImageProvider } from "./types";

const base = () => process.env.ARK_BASE_URL ?? "https://ark.ap-southeast.bytepluses.com/api/v3";

// WIDTHxHEIGHT (each a multiple of 16) for a ratio near a target pixel count, then pulled inside the model's allowed pixel range.
export function arkSize(ratio: string | undefined, tier: string | undefined, rule: SizeRule): string {
  const known = rule.table?.[tier ?? ""]?.[ratio ?? "1:1"];
  if (known) return known;
  const [rw, rh] = (ratio ?? "1:1").split(":").map(Number);
  const r = rw > 0 && rh > 0 ? rw / rh : 1;
  const target = rule.px[tier ?? ""] ?? Object.values(rule.px)[0];
  const make = (area: number) => { const w = Math.sqrt(area * r); return [Math.max(16, Math.round(w / 16) * 16), Math.max(16, Math.round(w / r / 16) * 16)]; };
  let [w, h] = make(target);
  for (let i = 0; i < 40 && w * h > rule.max; i++) [w, h] = make(Math.min(rule.max, w * h) * 0.97);
  for (let i = 0; i < 40 && w * h < rule.min; i++) [w, h] = make(Math.max(rule.min, w * h) * 1.03);
  return `${w}x${h}`;
}

export function arkRequest(input: SyncGenerateInput, png: boolean): Record<string, unknown> {
  return {
    model: input.apiModel,
    prompt: input.prompt,
    ...(input.references.length ? { image: input.references.map((r) => `data:${r.contentType.toLowerCase()};base64,${Buffer.from(r.bytes).toString("base64")}`) } : {}),
    ...(input.sizeRule ? { size: arkSize(input.aspectRatio, input.resolution, input.sizeRule) } : {}),
    ...(png ? { output_format: "png" } : {}), // not offered by 4.5 and 4.0
    response_format: "b64_json",
    watermark: false,
  };
}

export const byteplus: SyncImageProvider = {
  async generate(input): Promise<SyncGenerateResult> {
    const key = process.env.ARK_API_KEY;
    if (!key) throw new ProviderError("Seedream is not set up yet.", "ARK_API_KEY is not set");
    let res: Response;
    try {
      res = await fetch(`${base()}/images/generations`, { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify(arkRequest(input, input.outputPng === true)), signal: input.signal });
    } catch (e) {
      if (e instanceof DOMException && (e.name === "TimeoutError" || e.name === "AbortError")) throw new ProviderError("This render took too long and was stopped. Please try again.", "timed out waiting for BytePlus");
      throw new ProviderError("Seedream could not be reached. Please try again.", e instanceof Error ? e.message : "network error");
    }
    const text = await res.text();
    let json: { data?: { b64_json?: string; error?: { code?: string; message?: string } }[]; usage?: unknown; error?: { code?: string; message?: string } } | null = null;
    try { json = JSON.parse(text); } catch {}
    const err = json?.error ?? json?.data?.[0]?.error;
    if (!res.ok || err) {
      const why = err?.message ?? text.slice(0, 300);
      const code = err?.code ?? "";
      if (/sensitive|moderation|content|safety|violat/i.test(code + " " + why)) throw new ProviderError("Seedream's safety filter blocked this image. Try a different prompt.", `${res.status} ${code}: ${why}`);
      if (res.status === 429) throw new ProviderError("Seedream is limiting requests right now. Please try again in a minute.", `${res.status} ${code}: ${why}`);
      if (res.status === 401 || res.status === 403) throw new ProviderError("Seedream rejected our key or the model is not activated for our account. The owner needs to check it.", `${res.status} ${code}: ${why}`);
      throw new ProviderError("Seedream could not make this image. Please try again.", `${res.status} ${code}: ${why}`);
    }
    const b64 = json?.data?.[0]?.b64_json;
    if (!b64) throw new ProviderError("Seedream did not return a picture.", `no b64_json in the reply: ${text.slice(0, 200)}`);
    const bytes = new Uint8Array(Buffer.from(b64, "base64"));
    return { bytes, contentType: bytes[0] === 0x89 && bytes[1] === 0x50 ? "image/png" : "image/jpeg", usage: json?.usage };
  },
};
