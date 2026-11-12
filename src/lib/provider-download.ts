import { isIP } from "node:net";
import { isPrivateAddress } from "@/lib/fetch-page";

// Downloads a file whose address a PROVIDER gave us (a finished picture or 3D model). Never trusts the answer: https on the normal port only,
// never an address inside a private network (names are not resolved here), redirects followed by hand so every hop is checked, and the body is read
// as a stream that stops at the size cap whatever the headers claimed. `testHost` lets a test server on plain http through, on that host only.
export function providerUrl(raw: string, testHost?: string | null): URL {
  const u = new URL(raw);
  if (testHost && u.host === testHost && (u.protocol === "http:" || u.protocol === "https:")) return u;
  const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (u.protocol !== "https:" || (u.port && u.port !== "443") || u.username || u.password) throw new Error("not an allowed link");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal") || (isIP(host) !== 0 && isPrivateAddress(host))) throw new Error("not an allowed link");
  return u;
}

export async function downloadProviderFile(raw: string, maxBytes: number, opts: { timeoutMs?: number; testHost?: string | null } = {}): Promise<{ bytes: Uint8Array; res: Response }> {
  let u = providerUrl(raw, opts.testHost), res: Response | null = null;
  for (let hop = 0; hop < 4; hop++) {
    res = await fetch(u, { signal: AbortSignal.timeout(opts.timeoutMs ?? 60_000), redirect: "manual" });
    const to = res.status >= 300 && res.status < 400 ? res.headers.get("location") : null;
    if (!to) break;
    u = providerUrl(new URL(to, u).toString(), opts.testHost); res = null;
  }
  if (!res) throw new Error("too many redirects");
  if (!res.ok) throw new Error(`download ${res.status}`);
  if (Number(res.headers.get("content-length") ?? 0) > maxBytes) throw new Error("file too large");
  const reader = res.body?.getReader();
  if (!reader) throw new Error("empty download");
  const chunks: Uint8Array[] = []; let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > maxBytes) { await reader.cancel().catch(() => {}); throw new Error("file too large"); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total); let at = 0;
  for (const c of chunks) { bytes.set(c, at); at += c.length; }
  return { bytes, res };
}
