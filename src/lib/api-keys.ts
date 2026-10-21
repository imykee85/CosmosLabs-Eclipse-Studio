import { createHash, randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { gateFeatureFor } from "@/lib/access";
import { claimUsage } from "@/lib/usage";

// Personal API keys for the public API (/api/v1) and the MCP endpoint (/api/mcp). A key is `ecl_` plus 40 random characters; it is shown
// once when made and only its SHA-256 is kept, so a database leak gives no working key. A person may hold 10 live keys.
export const MAX_KEYS = 10;
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
export const hashKey = (key: string) => createHash("sha256").update(key).digest("hex");

export function newKeyString(): string {
  const bytes = randomBytes(40);
  let out = "";
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length];
  return `ecl_${out}`;
}

export async function createKey(userId: string, name: string): Promise<{ ok: true; key: string; id: string } | { ok: false; error: string }> {
  const live = await db.apiKey.count({ where: { userId, revokedAt: null } });
  if (live >= MAX_KEYS) return { ok: false, error: `You can have up to ${MAX_KEYS} keys. Revoke one first.` };
  const key = newKeyString();
  const row = await db.apiKey.create({ data: { userId, name: name.trim().slice(0, 60) || "My key", prefix: key.slice(0, 10), hash: hashKey(key) } });
  return { ok: true, key, id: row.id };
}

export type KeyAuth = { ok: true; userId: string; keyId: string } | { ok: false; status: number; error: string };

/** The person a request acts for, from its "Authorization: Bearer ecl_..." header. Rate limited to API_RPM requests a minute per key (Config value, default 60). */
export async function authenticateKey(req: Request): Promise<KeyAuth> {
  const h = req.headers.get("authorization") ?? "";
  const m = h.match(/^Bearer\s+(ecl_[A-Za-z0-9]{20,80})$/);
  if (!m) return { ok: false, status: 401, error: "Send your API key as: Authorization: Bearer ecl_..." };
  const row = await db.apiKey.findUnique({ where: { hash: hashKey(m[1]) } });
  if (!row || row.revokedAt) return { ok: false, status: 401, error: "That API key is not valid or was revoked." };
  // The API is part of every paid plan: a key stops working when its owner's plan lapses (the keys stay, they work again after subscribing).
  const allowed = await gateFeatureFor(row.userId, "api");
  if (!allowed.ok) return { ok: false, status: 402, error: allowed.body.error };
  const rpm = Number(process.env.API_RPM) > 0 ? Math.floor(Number(process.env.API_RPM)) : 60;
  if (!(await claimUsage(row.userId, `api:${row.id}`, rpm, 60_000))) return { ok: false, status: 429, error: `Too many requests: up to ${rpm} a minute per key.` };
  // Last-used is kept roughly (at most once a minute) so every call is not a write.
  if (!row.lastUsedAt || Date.now() - row.lastUsedAt.getTime() > 60_000) await db.apiKey.update({ where: { id: row.id }, data: { lastUsedAt: new Date() } }).catch(() => {});
  return { ok: true, userId: row.userId, keyId: row.id };
}
