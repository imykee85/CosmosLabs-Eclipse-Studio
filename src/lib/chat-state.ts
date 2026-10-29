import { db } from "@/lib/db";

// The chats people keep in the browser (Atlas and custom agents, the Atlas history, Prompts, Treatment) are copied to the account, so logging out or
// switching device does not lose them. A key is one browser storage key; its value is the text the browser stored. Last write wins by the browser's
// own clock (`clientAt`). Chats belong to the PERSON, not to a team workspace.
export const SYNC_PREFIXES = ["eclipse-agent-chat-", "eclipse-agent-history-", "eclipse-prompts-", "eclipse-treatment-"] as const;
export const MAX_VALUE_CHARS = 1_500_000;
export const MAX_KEYS = 300;

export const isSyncKey = (key: unknown): key is string =>
  typeof key === "string" && key.length <= 120 && /^[A-Za-z0-9_.:-]+$/.test(key) && SYNC_PREFIXES.some((p) => key.startsWith(p));

export type StateMeta = { key: string; at: number };

export async function listStates(userId: string): Promise<StateMeta[]> {
  const rows = await db.chatState.findMany({ where: { userId }, select: { key: true, clientAt: true }, take: MAX_KEYS });
  return rows.map((r) => ({ key: r.key, at: Number(r.clientAt) }));
}

export async function getState(userId: string, key: string): Promise<{ value: string; at: number } | null> {
  if (!isSyncKey(key)) return null;
  const r = await db.chatState.findUnique({ where: { userId_key: { userId, key } }, select: { value: true, clientAt: true } });
  return r ? { value: r.value, at: Number(r.clientAt) } : null;
}

export type PutResult = { ok: true; stale?: boolean } | { ok: false; status: number; error: string };

/** Saves a key's text. A copy that is older than the one already kept is ignored (`stale`); `null` removes the key. */
export async function putState(userId: string, key: unknown, value: unknown, clientAt: unknown): Promise<PutResult> {
  if (!isSyncKey(key)) return { ok: false, status: 400, error: "That chat cannot be saved to the account." };
  const at = Number(clientAt);
  if (!Number.isFinite(at) || at <= 0 || at > Date.now() + 24 * 3600_000) return { ok: false, status: 400, error: "Bad time." };
  const existing = await db.chatState.findUnique({ where: { userId_key: { userId, key } }, select: { clientAt: true } });
  if (existing && Number(existing.clientAt) > at) return { ok: true, stale: true };
  if (value === null) {
    if (existing) await db.chatState.deleteMany({ where: { userId, key } });
    return { ok: true };
  }
  if (typeof value !== "string") return { ok: false, status: 400, error: "Send the text as a string." };
  if (value.length > MAX_VALUE_CHARS) return { ok: false, status: 413, error: "That chat is too large to save to the account." };
  if (!existing && (await db.chatState.count({ where: { userId } })) >= MAX_KEYS) return { ok: false, status: 409, error: "Too many saved chats." };
  await db.chatState.upsert({
    where: { userId_key: { userId, key } },
    create: { userId, key, value, clientAt: BigInt(Math.floor(at)) },
    update: { value, clientAt: BigInt(Math.floor(at)) },
  });
  return { ok: true };
}
