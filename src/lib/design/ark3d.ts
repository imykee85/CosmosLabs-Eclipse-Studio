// 3D models on ByteDance's cloud (Volcano Ark / BytePlus ModelArk): a task API. From the owner's brief of 2026-11-12; NOT run against the live API (the sandbox cannot reach it).
//   create  POST {base}/contents/generations/tasks   { model, content: [...] }  ->  { id }
//   query   GET  {base}/contents/generations/tasks/<id>  ->  { status: queued | running | succeeded | failed, content.file_url (a .zip), error { code, message }, usage }
// The result link lasts 24 hours and holds a ZIP: it is downloaded at once, the .glb inside is taken out and kept in our own storage. A status we do not know counts as still running.
import { unzipSync } from "fflate";

export const ARK_PREFIX = "ark:";
const base = () => (process.env.ARK_BASE_URL ?? "https://ark.ap-southeast.bytepluses.com/api/v3").replace(/\/+$/, "");
const auth = () => { const k = process.env.ARK_API_KEY; if (!k) throw new Error("ARK_API_KEY is not set"); return { Authorization: `Bearer ${k}`, "Content-Type": "application/json" }; };

export async function submitArk(body: Record<string, unknown>): Promise<{ requestId: string; statusUrl: string }> {
  const res = await fetch(`${base()}/contents/generations/tasks`, { method: "POST", headers: auth(), body: JSON.stringify(body), signal: AbortSignal.timeout(60_000) });
  const text = await res.text();
  let j: { id?: string; error?: { code?: string; message?: string } } | null = null;
  try { j = JSON.parse(text); } catch {}
  if (!res.ok || !j?.id) throw new Error(`ark create ${res.status} ${j?.error?.code ?? ""} ${(j?.error?.message ?? text).slice(0, 300)}`);
  return { requestId: j.id, statusUrl: ARK_PREFIX + j.id };
}

export type ArkStatus = { state: "waiting" } | { state: "done"; url: string; usage?: unknown } | { state: "failed"; detail?: string; refused?: boolean };
export async function statusArk(statusUrl: string): Promise<ArkStatus> {
  const id = statusUrl.slice(ARK_PREFIX.length);
  if (!/^[A-Za-z0-9_.:-]{1,128}$/.test(id)) throw new Error("bad ark task id");
  const res = await fetch(`${base()}/contents/generations/tasks/${encodeURIComponent(id)}`, { headers: auth(), signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`ark status ${res.status}`);
  const j = (await res.json().catch(() => null)) as { status?: string; content?: { file_url?: string }; error?: { code?: string; message?: string }; usage?: unknown } | null;
  const s = String(j?.status ?? "").toLowerCase();
  if (s === "succeeded") { const url = j?.content?.file_url; return typeof url === "string" && url.startsWith("https://") ? { state: "done", url, usage: j?.usage } : { state: "failed", detail: "finished without a file" }; }
  if (s === "failed" || s === "cancelled" || s === "canceled") {
    const code = j?.error?.code ?? "", msg = j?.error?.message ?? "";
    return { state: "failed", detail: `${code} ${msg}`.trim(), refused: /sensitive|moderation|policy|safety|violat/i.test(`${code} ${msg}`) };
  }
  return { state: "waiting" }; // queued, running, or a word we do not know
}

/** The first .glb inside the zip the task returns. Throws when there is none or it is too large. */
export function glbFromZip(zip: Uint8Array, maxBytes: number): Uint8Array {
  const files = unzipSync(zip, { filter: (f) => /\.glb$/i.test(f.name) && f.originalSize <= maxBytes });
  const name = Object.keys(files).sort()[0];
  if (!name) throw new Error("no .glb in the archive");
  return files[name];
}
