import { db } from "@/lib/db";
import { getBalance, spendUpTo } from "@/lib/credits";
import { BASE_URL, headers, HiggsfieldError } from "@/lib/higgsfield";
import { deliverReferences, parseReferenceRefs, resolveReferences } from "@/lib/references";
import { safeText } from "@/lib/safe-text";
import { claimUsage } from "@/lib/usage";
import type { SoulId } from "@prisma/client";

// Soul ID training (owner's Higgsfield reference): POST <base>/v1/custom-references { name (max 100), model_version: v1|v2|cinema, input_images: 1 to 100
// of { type: "image_url", image_url } }, then GET <base>/v1/custom-references/<id> until "completed". The trained id must belong to the same Higgsfield
// account, so only ids made here are offered. On a Soul render it is sent as custom_reference_id with custom_reference_strength in (0, 1].
// Training cost is not published: SOUL_ID_CREDITS (Config value, default 100, PROVISIONAL) is charged once when training completes.
// NOT verified live: the exact host and path (HIGGSFIELD_SOUL_ID_PATH overrides "v1/custom-references") and the status words.
export const SOUL_MODELS: Record<string, "v1" | "v2" | "cinema"> = { soul: "v1", soul_v2: "v2", soul_cinema: "cinema" };
export const MIN_PICS = 5, MAX_PICS = 30;
const PATH = () => (process.env.HIGGSFIELD_SOUL_ID_PATH ?? "v1/custom-references").replace(/^\/+|\/+$/g, "");
const PRICE = () => (Number(process.env.SOUL_ID_CREDITS) > 0 ? Math.floor(Number(process.env.SOUL_ID_CREDITS)) : 100);
const creditsOn = () => process.env.CREDITS_ENABLED === "1";
const GIVE_UP_MS = 2 * 3600_000;

export type SoulIdItem = { id: string; name: string; modelVersion: string; status: string; error: string | null; imageCount: number; thumb: { type: string; id: string } | null; createdAt: Date };
export const soulItem = (s: SoulId): SoulIdItem => ({ id: s.id, name: s.name, modelVersion: s.modelVersion, status: s.status, error: s.error, imageCount: s.imageCount, thumb: s.thumbId && s.thumbType ? { type: s.thumbType, id: s.thumbId } : null, createdAt: s.createdAt });

export async function startSoulId(userId: string, input: { name: unknown; version: unknown; pictures: unknown }): Promise<{ ok: true; item: SoulIdItem } | { ok: false; status: number; error: string }> {
  if (!process.env.HIGGSFIELD_API_KEY) return { ok: false, status: 503, error: "Soul ID is not set up yet." };
  const name = typeof input.name === "string" ? input.name.trim().slice(0, 100) : "";
  if (!name) return { ok: false, status: 400, error: "Give the Soul ID a name." };
  const version = input.version === "v1" || input.version === "v2" || input.version === "cinema" ? input.version : null;
  if (!version) return { ok: false, status: 400, error: "Choose Soul, Soul 2 or Soul Cinema." };
  const refs = parseReferenceRefs(input.pictures, MAX_PICS);
  if (!refs) return { ok: false, status: 400, error: "The pictures were not understood." };
  if (refs.length < MIN_PICS) return { ok: false, status: 400, error: `Choose at least ${MIN_PICS} pictures of the same person (${MAX_PICS} at most).` };
  const price = creditsOn() ? PRICE() : null;
  if (price != null && (await getBalance(userId)) < price) return { ok: false, status: 402, error: `Training a Soul ID costs ${price} credits.` };
  if ((await db.soulId.count({ where: { userId, status: "pending" } })) >= 2) return { ok: false, status: 429, error: "Two Soul IDs are already training. Wait for one to finish." };
  if (!(await claimUsage(userId, "soul-id", 10, 24 * 3600_000))) return { ok: false, status: 429, error: "You have trained 10 Soul IDs today. Try again tomorrow." };
  const resolved = await resolveReferences(userId, refs);
  if (!resolved.ok) return { ok: false, status: 400, error: resolved.error };
  const urls = await deliverReferences(resolved.items);
  const res = await fetch(`${BASE_URL}/${PATH()}`, { method: "POST", headers: headers(), body: JSON.stringify({ name, model_version: version, input_images: urls.map((u) => ({ type: "image_url", image_url: u })) }), signal: AbortSignal.timeout(30_000) }).catch(() => null);
  if (!res) return { ok: false, status: 502, error: "Higgsfield could not be reached. Please try again." };
  const text = await res.text();
  if (!res.ok) { console.error("soul id start failed", res.status, text.slice(0, 300)); return { ok: false, status: 502, error: `Higgsfield did not accept the training (${res.status}): ${safeText(text.slice(0, 160))}` }; }
  let providerId = "";
  try { const j = JSON.parse(text); providerId = String(j.id ?? j.custom_reference_id ?? j.reference_id ?? ""); } catch {}
  if (!providerId) return { ok: false, status: 502, error: "Higgsfield answered without an id for the training." };
  const row = await db.soulId.create({ data: { userId, name, modelVersion: version, providerId, status: "pending", imageCount: refs.length, thumbId: refs[0].id, thumbType: refs[0].type, credits: price } });
  return { ok: true, item: soulItem(row) };
}

/** Asks Higgsfield about a training that is still running and records the answer (charging once when it completes). */
export async function refreshSoulId(row: SoulId): Promise<SoulId> {
  if (row.status !== "pending" || !row.providerId) return row;
  if (Date.now() - row.createdAt.getTime() > GIVE_UP_MS) return db.soulId.update({ where: { id: row.id }, data: { status: "failed", error: "Training took too long and was stopped waiting. No Eclipse credits were used." } });
  let status = "", reason = "";
  try {
    const res = await fetch(`${BASE_URL}/${PATH()}/${encodeURIComponent(row.providerId)}`, { headers: headers(), signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return row;
    const j = await res.json().catch(() => ({}));
    status = String(j.status ?? "").toLowerCase();
    reason = String(j.error ?? j.message ?? "");
  } catch { return row; }
  if (status === "completed" || status === "ready" || status === "succeeded") {
    const claimed = await db.soulId.updateMany({ where: { id: row.id, status: "pending" }, data: { status: "completed" } });
    if (claimed.count && row.credits) await spendUpTo(row.userId, row.credits, `Soul ID: ${row.name}`).catch((e) => console.error("charging soul id failed", e));
  } else if (status === "failed" || status === "error" || status === "canceled" || status === "nsfw") {
    await db.soulId.updateMany({ where: { id: row.id, status: "pending" }, data: { status: "failed", error: status === "nsfw" ? "The pictures were refused by the content filter. No Eclipse credits were used." : `Training failed${reason ? `: ${safeText(reason.slice(0, 160))}` : ""}. No Eclipse credits were used.` } });
  }
  return (await db.soulId.findUnique({ where: { id: row.id } })) ?? row;
}

/** The fields a Soul render carries for a chosen Soul ID, after checking it is the person's own, finished, and made for this model. */
export async function soulIdFields(userId: string, modelId: string, soulId: unknown, strength: unknown): Promise<{ ok: true; fields: Record<string, unknown> | null } | { ok: false; error: string }> {
  if (soulId == null || soulId === "") return { ok: true, fields: null };
  const version = SOUL_MODELS[modelId];
  if (!version) return { ok: false, error: "A Soul ID works only with Soul, Soul 2 and Soul Cinema." };
  if (typeof soulId !== "string" || soulId.length > 64) return { ok: false, error: "That Soul ID was not understood." };
  const row = await db.soulId.findFirst({ where: { id: soulId, userId } });
  if (!row || row.status !== "completed" || !row.providerId) return { ok: false, error: "That Soul ID is not ready." };
  if (row.modelVersion !== version) return { ok: false, error: `That Soul ID was trained for ${row.modelVersion === "v1" ? "Soul" : row.modelVersion === "v2" ? "Soul 2" : "Soul Cinema"}.` };
  const s = typeof strength === "number" && strength > 0 && strength <= 1 ? Math.round(strength * 100) / 100 : 1;
  return { ok: true, fields: { custom_reference_id: row.providerId, custom_reference_strength: s } };
}
export { HiggsfieldError };
