import { db } from "./db";
import { newShareToken, validToken } from "./canvas-api";

// What canvases share between people: a read-only link, comments and saved templates. The routes under /api are thin wrappers around these (and they are what the tests call).
// `workspace` is the id canvases are stored under (a person's own id, or a team's); `person` is who is acting.

export const MAX_COMMENTS = 300;
export const MAX_TEMPLATES = 40;
export type Result<T> = ({ ok: true } & T) | { ok: false; status: number; error: string };

// ---------- the read-only link ----------
export async function getShare(workspace: string, canvasId: string): Promise<Result<{ enabled: boolean; path: string | null }>> {
  const row = await db.canvas.findFirst({ where: { id: canvasId, userId: workspace }, select: { share: { select: { token: true } } } });
  if (!row) return { ok: false, status: 404, error: "Not found" };
  return { ok: true, enabled: !!row.share, path: row.share ? `/v/${row.share.token}` : null };
}

export async function setShare(workspace: string, canvasId: string, enabled: boolean): Promise<Result<{ enabled: boolean; path: string | null }>> {
  const row = await db.canvas.findFirst({ where: { id: canvasId, userId: workspace, deletedAt: null }, select: { id: true, share: { select: { token: true } } } });
  if (!row) return { ok: false, status: 404, error: "Not found" };
  if (!enabled) { await db.canvasShare.deleteMany({ where: { canvasId: row.id } }); return { ok: true, enabled: false, path: null }; }
  if (row.share) return { ok: true, enabled: true, path: `/v/${row.share.token}` };
  // Two taps at once: the second create loses on the primary key and reads the first one's token.
  const token = newShareToken();
  const made = await db.canvasShare.create({ data: { canvasId: row.id, token } }).catch(async () => db.canvasShare.findUnique({ where: { canvasId: row.id } }));
  if (!made) return { ok: false, status: 500, error: "Could not change the link." };
  return { ok: true, enabled: true, path: `/v/${made.token}` };
}

/** The stored file behind an id that a shared canvas mentions, or null. Only ids the canvas itself contains, owned by its workspace, finished and not in the bin. */
export async function sharedMedia(token: string, id: string): Promise<{ key: string; mime: string } | null> {
  if (!validToken(token) || !/^[\w-]{6,64}$/.test(id)) return null;
  const canvas = await db.canvas.findFirst({ where: { share: { is: { token } }, deletedAt: null }, select: { userId: true, data: true } });
  if (!canvas || !JSON.stringify(canvas.data).includes(`"${id}"`)) return null;
  const owner = canvas.userId;
  const gen = await db.generation.findFirst({ where: { id, userId: owner, status: "completed", deletedAt: null }, select: { storageKey: true, contentType: true } });
  if (gen?.storageKey) return { key: gen.storageKey, mime: gen.contentType ?? "application/octet-stream" };
  const up = await db.upload.findFirst({ where: { id, userId: owner }, select: { storageKey: true, contentType: true } });
  if (up?.storageKey) return { key: up.storageKey, mime: up.contentType };
  const au = await db.audioJob.findFirst({ where: { id, userId: owner, status: "completed", deletedAt: null }, select: { storageKey: true, contentType: true } });
  if (au?.storageKey) return { key: au.storageKey, mime: au.contentType ?? "audio/mpeg" };
  return null;
}

// ---------- comments ----------
export type CommentOut = { id: string; author: string; mine: boolean; nodeId: string | null; text: string; resolved: boolean; createdAt: string };
const shape = (c: { id: string; userId: string; authorName: string; nodeId: string | null; text: string; resolved: boolean; createdAt: Date }, me: string): CommentOut => ({
  id: c.id, author: c.authorName, mine: c.userId === me, nodeId: c.nodeId, text: c.text, resolved: c.resolved, createdAt: c.createdAt.toISOString(),
});

export async function listComments(workspace: string, person: string, canvasId: string): Promise<Result<{ items: CommentOut[] }>> {
  const canvas = await db.canvas.findFirst({ where: { id: canvasId, userId: workspace }, select: { id: true } });
  if (!canvas) return { ok: false, status: 404, error: "Not found" };
  const rows = await db.canvasComment.findMany({ where: { canvasId: canvas.id }, orderBy: { createdAt: "asc" }, take: MAX_COMMENTS });
  return { ok: true, items: rows.map((c) => shape(c, person)) };
}

export async function addComment(workspace: string, person: string, authorName: string, canvasId: string, text: unknown, nodeId: unknown): Promise<Result<{ item: CommentOut }>> {
  const t = typeof text === "string" ? text.trim().slice(0, 1000) : "";
  if (!t) return { ok: false, status: 400, error: "Write a comment first." };
  const node = typeof nodeId === "string" && /^[\w-]{1,80}$/.test(nodeId) ? nodeId : null;
  const canvas = await db.canvas.findFirst({ where: { id: canvasId, userId: workspace, deletedAt: null }, select: { id: true } });
  if (!canvas) return { ok: false, status: 404, error: "Not found" };
  if ((await db.canvasComment.count({ where: { canvasId: canvas.id } })) >= MAX_COMMENTS) return { ok: false, status: 409, error: "This canvas has the most comments it can hold. Delete some first." };
  const row = await db.canvasComment.create({ data: { canvasId: canvas.id, userId: person, authorName: authorName.slice(0, 60) || "Someone", nodeId: node, text: t } });
  return { ok: true, item: shape(row, person) };
}

export async function setResolved(workspace: string, canvasId: string, commentId: string, resolved: boolean): Promise<Result<object>> {
  const canvas = await db.canvas.findFirst({ where: { id: canvasId, userId: workspace }, select: { id: true } });
  if (!canvas) return { ok: false, status: 404, error: "Not found" };
  const hit = await db.canvasComment.updateMany({ where: { id: commentId, canvasId: canvas.id }, data: { resolved } });
  return hit.count ? { ok: true } : { ok: false, status: 404, error: "Not found" };
}

export async function deleteComment(workspace: string, canvasId: string, commentId: string): Promise<Result<object>> {
  const canvas = await db.canvas.findFirst({ where: { id: canvasId, userId: workspace }, select: { id: true } });
  if (!canvas) return { ok: false, status: 404, error: "Not found" };
  const hit = await db.canvasComment.deleteMany({ where: { id: commentId, canvasId: canvas.id } });
  return hit.count ? { ok: true } : { ok: false, status: 404, error: "Not found" };
}

// ---------- templates ----------
export async function listTemplates(workspace: string) {
  const rows = await db.canvasTemplate.findMany({ where: { userId: workspace }, orderBy: { createdAt: "asc" }, take: MAX_TEMPLATES });
  return rows.map((r) => ({ id: r.id, name: r.name, data: r.data }));
}

export async function addTemplate(workspace: string, name: unknown, nodes: unknown, edges: unknown): Promise<Result<{ item: { id: string; name: string; data: unknown } }>> {
  const n = typeof name === "string" ? name.trim().slice(0, 40) : "";
  if (!n) return { ok: false, status: 400, error: "Give the template a name." };
  if (!Array.isArray(nodes) || !Array.isArray(edges) || nodes.length < 1 || nodes.length > 300 || edges.length > 600) return { ok: false, status: 400, error: "Invalid template" };
  if ((await db.canvasTemplate.count({ where: { userId: workspace } })) >= MAX_TEMPLATES) return { ok: false, status: 409, error: `You can keep up to ${MAX_TEMPLATES} templates. Delete one first.` };
  const row = await db.canvasTemplate.create({ data: { userId: workspace, name: n, data: { nodes, edges } as object } });
  return { ok: true, item: { id: row.id, name: row.name, data: row.data } };
}

export async function removeTemplate(workspace: string, id: string): Promise<boolean> {
  return (await db.canvasTemplate.deleteMany({ where: { id, userId: workspace } })).count > 0;
}
