// 3D models take minutes. start3D validates, HOLDS the price, asks the maker to start and returns a pending row; whoever asks next (the page polls
// GET /api/design/3d/<id>) checks the maker once, and when the file is ready the row is claimed (atomic), the .glb is copied into private storage, credits
// are charged once and the row completes. A failed, refused or timed-out model charges nothing (releasing the hold is the refund).
import type { Model3D } from "@prisma/client";
import { createModel3DHeld } from "../reservations";
import { creditsOn } from "../billing";
import { outOfCredits } from "../credit-message";
import { spendCredits } from "../credits";
import { db } from "../db";
import { headers, HiggsfieldError } from "../higgsfield";
import { checked, submitVideo } from "../higgsfield-video";
import { checkPrompt } from "../moderation";
import { deliverReferences, resolveReferences, type ReferenceRef } from "../references";
import { safeText } from "../safe-text";
import { deleteObject, putObject, storageEnabled } from "../storage";
import { claimUsage } from "../usage";
import { MAX_PROMPT_3D, buildBody3D, cleanOptions, find3D, isOn3D, path3D, price3D, type Mode3D } from "./models3d";
import { ARK_PREFIX, glbFromZip, statusArk, submitArk } from "./ark3d";

const TIMEOUT_MS = 20 * 60_000, SAVING_STALE_MS = 5 * 60_000, START_GRACE_MS = 2 * 60_000, MAX_FILE = 80 * 1024 * 1024;
export const MAX_RUNNING_3D = 2;

export type Item3D = { id: string; model: string; modelLabel: string; mode: string; name: string; prompt: string; status: string; error: string | null; sizeBytes: number | null; createdAt: string; fileUrl: string | null; inputs: ReferenceRef[] };
export const toItem3D = (r: Model3D): Item3D => ({
  id: r.id, model: r.model, modelLabel: find3D(r.model)?.label ?? r.model, mode: r.mode, name: r.name, prompt: r.prompt, status: r.status, error: r.error, sizeBytes: r.sizeBytes, createdAt: r.createdAt.toISOString(),
  fileUrl: r.status === "completed" && r.storageKey ? `/api/design/3d/${r.id}/file` : null, inputs: Array.isArray(r.inputs) ? (r.inputs as ReferenceRef[]) : [],
});

export type Start3DResult = { ok: true; item: Item3D } | { ok: false; status: number; error: string; code?: string };
const bad = (status: number, error: string): Start3DResult => ({ ok: false, status, error });

export async function start3D(i: { userId: string; model: unknown; mode: unknown; prompt: unknown; refs: unknown; options: unknown; name?: unknown; projectId?: unknown }): Promise<Start3DResult> {
  const m = find3D(i.model);
  if (!m || !isOn3D(m)) return bad(400, "Choose a model.");
  const mode = (i.mode === "text" || i.mode === "multi" || i.mode === "image" ? i.mode : "image") as Mode3D;
  if (!m.modes.includes(mode)) return bad(400, `${m.label} does not make models from ${mode === "text" ? "words" : "pictures"} that way.`);
  if (!storageEnabled) return bad(503, "Saving models is not available yet. Please try again later.");
  const prompt = typeof i.prompt === "string" ? i.prompt.trim().slice(0, MAX_PROMPT_3D) : "";
  const refs: ReferenceRef[] = (Array.isArray(i.refs) ? i.refs : []).filter((r): r is ReferenceRef => !!r && typeof r === "object" && ((r as ReferenceRef).type === "upload" || (r as ReferenceRef).type === "render") && typeof (r as ReferenceRef).id === "string").map((r) => ({ type: r.type, id: r.id.slice(0, 80) })).slice(0, 4);
  if (mode === "text") { if (prompt.length < 3) return bad(400, "Describe what to make."); const c = checkPrompt(prompt); if (!c.ok) return bad(422, c.reason); }
  else if (refs.length < m.minImages) return bad(400, m.minImages > 1 ? `${m.label} needs at least ${m.minImages} pictures.` : "Add a picture first.");
  else if (refs.length > m.maxImages) return bad(400, `${m.label} takes up to ${m.maxImages} picture${m.maxImages > 1 ? "s" : ""}.`);
  if (!(await claimUsage(i.userId, "design-3d", 12, 60_000))) return bad(429, "Too many at once. Try again in a minute.");
  if ((await db.model3D.count({ where: { userId: i.userId, status: { in: ["pending", "saving"] } } })) >= MAX_RUNNING_3D) return bad(429, `${MAX_RUNNING_3D} models are already being made. Wait for one to finish.`);

  let urls: string[] = [];
  if (mode !== "text") {
    const r = await resolveReferences(i.userId, refs);
    if (!r.ok) return bad(404, r.error);
    urls = await deliverReferences(r.items);
  }
  const options = cleanOptions(m, i.options);
  const cost = creditsOn() ? price3D(m) : 0;
  const name = typeof i.name === "string" && i.name.trim() ? i.name.trim().slice(0, 80) : prompt.slice(0, 60) || "3D model";
  const idemKey = crypto.randomUUID();
  const data = { userId: i.userId, projectId: typeof i.projectId === "string" ? i.projectId.slice(0, 80) : null, model: m.id, mode, name, prompt, inputs: refs as object, params: { options } as object, idemKey, creditsHeld: cost || null };
  const made = cost > 0 ? await createModel3DHeld(i.userId, cost, data) : { row: await db.model3D.create({ data }) };
  if (!("row" in made)) return { ok: false, status: 402, error: outOfCredits("This model", cost, made.have, made.held, false, made.locked), code: "CREDITS" };
  let row = made.row;
  try {
    const body = buildBody3D(m, mode, { prompt, urls, options });
    const sub = m.route === "ark" ? await submitArk(body) : await submitVideo(path3D(m), body, idemKey);
    row = await db.model3D.update({ where: { id: row.id }, data: { statusUrl: sub.statusUrl, requestId: sub.requestId || null } });
  } catch (err) {
    console.error("3D model start failed", row.id, err);
    await db.model3D.delete({ where: { id: row.id } }).catch(() => {});
    return bad(502, `${m.label} could not start this model. Nothing was charged.${err instanceof HiggsfieldError ? "" : ""}`);
  }
  return { ok: true, item: toItem3D(row) };
}

type Raw = { status?: string; error?: unknown; [k: string]: unknown };
/** The first https address in a maker's answer that points at a .glb file, wherever it sits. */
export function pickGlbUrl(v: unknown, depth = 0): string | null {
  if (depth > 6 || v == null) return null;
  if (typeof v === "string") return /^https:\/\/\S+\.glb(\?\S*)?$/i.test(v) ? v : null;
  if (Array.isArray(v)) { for (const x of v) { const u = pickGlbUrl(x, depth + 1); if (u) return u; } return null; }
  if (typeof v === "object") { for (const x of Object.values(v as object)) { const u = pickGlbUrl(x, depth + 1); if (u) return u; } }
  return null;
}
export type Status3D = { state: "waiting" } | { state: "done"; url: string; zipped?: boolean; usage?: unknown } | { state: "failed"; detail?: string } | { state: "refused" };
export async function status3D(statusUrl: string): Promise<Status3D> {
  if (statusUrl.startsWith(ARK_PREFIX)) { const a = await statusArk(statusUrl); return a.state === "done" ? { state: "done", url: a.url, zipped: true, usage: a.usage } : a.state === "failed" ? (a.refused ? { state: "refused" } : { state: "failed", detail: a.detail }) : a; }
  const res = await fetch(checked(statusUrl), { headers: headers(), signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`status check failed (${res.status})`);
  const job = (await res.json()) as Raw;
  const s = String(job.status ?? "").toLowerCase();
  if (s === "completed") { const url = pickGlbUrl(job); return url ? { state: "done", url } : { state: "failed", detail: "finished without a .glb file" }; }
  if (s === "nsfw") return { state: "refused" };
  if (s === "failed" || s === "canceled" || s === "cancelled") return { state: "failed", detail: typeof job.error === "string" ? job.error : undefined };
  return { state: "waiting" };
}

async function fail(r: Model3D, error: string): Promise<Model3D> {
  await db.model3D.updateMany({ where: { id: r.id, status: { in: ["pending", "saving"] } }, data: { status: "failed", error, finishedAt: new Date() } });
  return (await db.model3D.findUnique({ where: { id: r.id } })) ?? r;
}
const fresh = async (r: Model3D) => (await db.model3D.findUnique({ where: { id: r.id } })) ?? r;

async function fetchGlb(url: string, zipped = false): Promise<Uint8Array> {
  const u = new URL(url);
  if (u.protocol !== "https:") throw new Error("not https");
  const res = await fetch(u, { signal: AbortSignal.timeout(60_000), redirect: "follow" });
  if (!res.ok) throw new Error(`download ${res.status}`);
  const len = Number(res.headers.get("content-length") ?? 0);
  if (len > (zipped ? 2 * MAX_FILE : MAX_FILE)) throw new Error("file too large");
  let buf: Uint8Array = new Uint8Array(await res.arrayBuffer());
  if (buf.length > (zipped ? 2 * MAX_FILE : MAX_FILE)) throw new Error("file too large");
  if (zipped) buf = glbFromZip(buf, MAX_FILE); // the ByteDance cloud answers with a zip holding the file
  if (buf.length < 12 || String.fromCharCode(buf[0], buf[1], buf[2], buf[3]) !== "glTF") throw new Error("not a glb file");
  return buf;
}

/** Checks a running model once and finishes it when it is done. Safe to call from many places at once. */
export async function finalize3D(r: Model3D): Promise<Model3D> {
  const stale = r.status === "saving" && Date.now() - r.updatedAt.getTime() > SAVING_STALE_MS;
  if (r.status !== "pending" && !stale) return r;
  const age = Date.now() - r.createdAt.getTime();
  if (!r.statusUrl) return age < START_GRACE_MS ? r : fail(r, "This model could not be started. Nothing was charged.");
  let s: Status3D;
  try { s = await status3D(r.statusUrl); } catch (err) {
    console.error("3D status check failed", r.id, err);
    return age > TIMEOUT_MS ? fail(r, "This model could not be retrieved. Nothing was charged.") : r;
  }
  if (s.state === "waiting") return age > TIMEOUT_MS ? fail(r, "This model took too long and was stopped. Nothing was charged.") : r;
  if (s.state === "refused") return fail(r, "The model was refused. Try a different picture or description.");
  if (s.state === "failed") { console.error("3D model failed at the maker", r.id, s.detail ? safeText(s.detail, 300) : ""); return fail(r, "The model could not be made. Nothing was charged."); }
  const claim = await db.model3D.updateMany({ where: { id: r.id, OR: [{ status: "pending" }, { status: "saving", updatedAt: { lt: new Date(Date.now() - SAVING_STALE_MS) } }] }, data: { status: "saving" } });
  if (claim.count === 0) return fresh(r);
  const key = `models3d/${r.userId}/${r.id}.glb`;
  let size = 0;
  try { const bytes = await fetchGlb(s.url, s.zipped); size = bytes.length; await putObject(key, bytes, "model/gltf-binary"); } catch (err) {
    console.error("saving the 3D model failed", r.id, err);
    const p = (r.params && typeof r.params === "object" ? r.params : {}) as Record<string, unknown>, tries = Number(p.copyTries ?? 0) + 1;
    if (tries >= 4) return fail(r, "The model was made but could not be saved. Nothing was charged.");
    await db.model3D.updateMany({ where: { id: r.id, status: "saving" }, data: { status: "pending", params: { ...p, copyTries: tries } as object } });
    return fresh(r);
  }
  if (r.creditsHeld && r.creditsHeld > 0) { try { await spendCredits(r.userId, r.creditsHeld, `${find3D(r.model)?.label ?? "3D"} model`); } catch (err) { console.error("charging for a 3D model failed", r.id, err); } }
  const done = (r.params && typeof r.params === "object" ? r.params : {}) as Record<string, unknown>;
  // The maker's own usage numbers (tokens) are kept so the real cost of each model can be worked out and the registry price corrected.
  await db.model3D.update({ where: { id: r.id }, data: { status: "completed", storageKey: key, sizeBytes: size, finishedAt: new Date(), error: null, ...(s.usage != null ? { params: { ...done, usage: s.usage } as object } : {}) } });
  return fresh(r);
}

export async function delete3D(userId: string, id: string): Promise<boolean> {
  const r = await db.model3D.findFirst({ where: { id, userId } });
  if (!r) return false;
  if (r.status === "pending" || r.status === "saving") return false; // still running: wait for it
  if (r.storageKey) await deleteObject(r.storageKey).catch(() => {});
  await db.model3D.delete({ where: { id } });
  return true;
}
