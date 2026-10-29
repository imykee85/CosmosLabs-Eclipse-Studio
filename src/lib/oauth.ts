import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";

// "Sign in with Eclipse" for the MCP endpoint: an OAuth 2.1 authorization server in the shape the MCP authorization spec asks for (authorization code with PKCE S256 only,
// dynamic client registration, public clients, rotating refresh tokens). An access token acts as the person who approved, in their personal workspace, exactly like an API key.
// Only hashes of codes and tokens are stored, so a database leak gives no working credential.
export const ACCESS_TTL_S = 3600;
export const REFRESH_TTL_S = 30 * 24 * 3600;
export const CODE_TTL_S = 300;
export const SCOPE = "eclipse";

const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
function random(prefix: string, length: number): string {
  let out = "";
  for (const b of randomBytes(length)) out += ALPHABET[b % ALPHABET.length];
  return `${prefix}${out}`;
}
const safeEqual = (a: string, b: string) => { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && timingSafeEqual(x, y); };
const s256 = (verifier: string) => createHash("sha256").update(verifier).digest("base64url");
const VERIFIER = /^[A-Za-z0-9\-._~]{43,128}$/;

// --- where an app may send the person back to ---------------------------------------------------------------------------------------------------------------
// Anyone can register a client, so the address it will receive the code at is checked against a short list: Claude's own addresses, loopback addresses for tools
// running on the person's computer (Claude Code, the MCP inspector) and the code editors that use their own address scheme. More hosts: OAUTH_REDIRECT_HOSTS (Config value).
const HOSTS = ["claude.ai", "www.claude.ai", "claude.com", "www.claude.com"];
const SCHEMES = ["cursor:", "vscode:", "vscode-insiders:"];
const LOOPBACK = ["localhost", "127.0.0.1", "[::1]"];
export function redirectAllowed(uri: unknown): boolean {
  if (typeof uri !== "string" || uri.length > 500) return false;
  let u: URL;
  try { u = new URL(uri); } catch { return false; }
  if (u.hash || u.username || u.password) return false;
  if (u.protocol === "https:") return [...HOSTS, ...(process.env.OAUTH_REDIRECT_HOSTS ?? "").split(",").map((h) => h.trim().toLowerCase()).filter(Boolean)].includes(u.hostname.toLowerCase());
  if (u.protocol === "http:") return LOOPBACK.includes(u.hostname);
  return SCHEMES.includes(u.protocol);
}

// --- clients ------------------------------------------------------------------------------------------------------------------------------------------------
export async function registerClient(input: { client_name?: unknown; redirect_uris?: unknown }): Promise<{ ok: true; client: { client_id: string; client_name: string; redirect_uris: string[] } } | { ok: false; error: string; description: string }> {
  const uris = Array.isArray(input.redirect_uris) ? input.redirect_uris : [];
  if (!uris.length || uris.length > 10) return { ok: false, error: "invalid_redirect_uri", description: "Give between 1 and 10 redirect_uris." };
  for (const u of uris) if (!redirectAllowed(u)) return { ok: false, error: "invalid_redirect_uri", description: "That redirect address is not allowed for Eclipse sign-in." };
  const name = (typeof input.client_name === "string" ? input.client_name.trim() : "").replace(/\s+/g, " ").slice(0, 80) || "An app";
  const id = random("ecc_", 28);
  await db.oauthClient.create({ data: { id, name, redirectUris: uris as string[] } });
  return { ok: true, client: { client_id: id, client_name: name, redirect_uris: uris as string[] } };
}
export async function getClient(id: unknown): Promise<{ id: string; name: string; redirectUris: string[] } | null> {
  if (typeof id !== "string" || !/^ecc_[A-Za-z0-9]{28}$/.test(id)) return null;
  const c = await db.oauthClient.findUnique({ where: { id } });
  return c ? { id: c.id, name: c.name, redirectUris: Array.isArray(c.redirectUris) ? (c.redirectUris as string[]) : [] } : null;
}

// --- the authorization request ------------------------------------------------------------------------------------------------------------------------------
export type AuthRequest = { clientId: string; clientName: string; redirectUri: string; codeChallenge: string; state: string };
export type AuthCheck =
  | { ok: true; req: AuthRequest }
  | { ok: false; kind: "page"; message: string }
  | { ok: false; kind: "redirect"; redirectUri: string; state: string; error: string; description: string };

/** Checks an authorization request. A bad client or redirect address is shown to the person and never redirected to; every other problem goes back to the app as an OAuth error. */
export async function checkAuthRequest(p: Record<string, string | undefined>, resourceOrigin: string): Promise<AuthCheck> {
  const client = await getClient(p.client_id);
  if (!client) return { ok: false, kind: "page", message: "This app is not known to Eclipse. Start the connection again from the app." };
  const redirectUri = p.redirect_uri ?? "";
  if (!client.redirectUris.includes(redirectUri) || !redirectAllowed(redirectUri)) return { ok: false, kind: "page", message: "This app asked to return to an address it did not register, so Eclipse stopped. Start the connection again from the app." };
  const state = (p.state ?? "").slice(0, 500);
  const fail = (error: string, description: string): AuthCheck => ({ ok: false, kind: "redirect", redirectUri, state, error, description });
  if (p.response_type !== "code") return fail("unsupported_response_type", "Only response_type=code is supported.");
  if (!p.code_challenge || !/^[A-Za-z0-9\-._~]{43,128}$/.test(p.code_challenge)) return fail("invalid_request", "A PKCE code_challenge is required.");
  if (p.code_challenge_method !== "S256") return fail("invalid_request", "Only code_challenge_method=S256 is supported.");
  if (p.resource) {
    let same = false;
    try { same = new URL(p.resource).origin === resourceOrigin; } catch { /* not a URL */ }
    if (!same) return fail("invalid_target", "That resource is not served by Eclipse.");
  }
  return { ok: true, req: { clientId: client.id, clientName: client.name, redirectUri, codeChallenge: p.code_challenge, state } };
}

/** The address to send the person back to, with the code (or the error) and the app's own state. */
export function redirectBack(redirectUri: string, params: Record<string, string>, state: string): string {
  const u = new URL(redirectUri);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  if (state) u.searchParams.set("state", state);
  return u.toString();
}

export async function issueCode(userId: string, r: AuthRequest): Promise<string> {
  const code = random("ecq_", 40);
  await db.oauthCode.create({ data: { hash: sha(code), clientId: r.clientId, userId, redirectUri: r.redirectUri, codeChallenge: r.codeChallenge, expiresAt: new Date(Date.now() + CODE_TTL_S * 1000) } });
  await db.oauthCode.deleteMany({ where: { expiresAt: { lt: new Date(Date.now() - 24 * 3600 * 1000) } } }).catch(() => {}); // tidy as we go
  return code;
}

// --- the token endpoint -------------------------------------------------------------------------------------------------------------------------------------
export type TokenOk = { ok: true; body: { access_token: string; token_type: "Bearer"; expires_in: number; refresh_token: string; scope: string } };
export type TokenErr = { ok: false; error: string; description: string };
const bad = (description: string, error = "invalid_grant"): TokenErr => ({ ok: false, error, description });
const pair = () => ({ access: random("eca_", 40), refresh: random("ecr_", 48) });
const body = (access: string, refresh: string): TokenOk["body"] => ({ access_token: access, token_type: "Bearer", expires_in: ACCESS_TTL_S, refresh_token: refresh, scope: SCOPE });

export async function exchangeCode(p: { code: string; clientId: string; redirectUri: string; verifier: string }): Promise<TokenOk | TokenErr> {
  if (!VERIFIER.test(p.verifier)) return bad("The code_verifier is not valid.");
  const row = await db.oauthCode.findUnique({ where: { hash: sha(p.code) } });
  if (!row) return bad("That code is not valid.");
  // A code is used once. Showing it a second time means it leaked: the grant it made is revoked.
  if (row.usedAt) { if (row.grantId) await db.oauthGrant.updateMany({ where: { id: row.grantId, revokedAt: null }, data: { revokedAt: new Date() } }); return bad("That code was already used."); }
  if (row.expiresAt.getTime() < Date.now()) return bad("That code has expired. Start the connection again.");
  if (row.clientId !== p.clientId || row.redirectUri !== p.redirectUri) return bad("That code was not issued to this app.");
  if (!safeEqual(s256(p.verifier), row.codeChallenge)) return bad("The code_verifier does not match.");
  const claimed = await db.oauthCode.updateMany({ where: { hash: row.hash, usedAt: null }, data: { usedAt: new Date() } });
  if (claimed.count !== 1) return bad("That code was already used.");
  const t = pair();
  const grant = await db.oauthGrant.create({ data: { clientId: row.clientId, userId: row.userId, accessHash: sha(t.access), refreshHash: sha(t.refresh), accessExpiresAt: new Date(Date.now() + ACCESS_TTL_S * 1000), refreshExpiresAt: new Date(Date.now() + REFRESH_TTL_S * 1000) } });
  await db.oauthCode.update({ where: { hash: row.hash }, data: { grantId: grant.id } });
  return { ok: true, body: body(t.access, t.refresh) };
}

export async function refreshGrant(p: { refreshToken: string; clientId: string }): Promise<TokenOk | TokenErr> {
  const h = sha(p.refreshToken);
  const grant = await db.oauthGrant.findUnique({ where: { refreshHash: h } });
  if (!grant) {
    // A refresh token that was already replaced: it leaked (or the app lost the new one). Either way the grant is closed.
    const old = await db.oauthGrant.findFirst({ where: { prevRefreshHash: h, clientId: p.clientId } });
    if (old) await db.oauthGrant.updateMany({ where: { id: old.id, revokedAt: null }, data: { revokedAt: new Date() } });
    return bad("That refresh token is not valid.");
  }
  if (grant.revokedAt || grant.clientId !== p.clientId || grant.refreshExpiresAt.getTime() < Date.now()) return bad("That refresh token is not valid.");
  const t = pair();
  const won = await db.oauthGrant.updateMany({
    where: { id: grant.id, refreshHash: h, revokedAt: null },
    data: { accessHash: sha(t.access), refreshHash: sha(t.refresh), prevRefreshHash: h, accessExpiresAt: new Date(Date.now() + ACCESS_TTL_S * 1000), refreshExpiresAt: new Date(Date.now() + REFRESH_TTL_S * 1000) },
  });
  if (won.count !== 1) return bad("That refresh token is not valid.");
  return { ok: true, body: body(t.access, t.refresh) };
}

// --- using a token, and ending one ----------------------------------------------------------------------------------------------------------------------------
export async function authenticateOauth(token: string): Promise<{ userId: string; grantId: string } | null> {
  if (!/^eca_[A-Za-z0-9]{40}$/.test(token)) return null;
  const g = await db.oauthGrant.findUnique({ where: { accessHash: sha(token) } });
  if (!g || g.revokedAt || g.accessExpiresAt.getTime() < Date.now()) return null;
  if (!g.lastUsedAt || Date.now() - g.lastUsedAt.getTime() > 60_000) await db.oauthGrant.update({ where: { id: g.id }, data: { lastUsedAt: new Date() } }).catch(() => {});
  return { userId: g.userId, grantId: g.id };
}

/** RFC 7009: ends the grant a token belongs to. An unknown token is not an error. */
export async function revokeToken(token: string, clientId: string): Promise<void> {
  const h = sha(token);
  await db.oauthGrant.updateMany({ where: { clientId, revokedAt: null, OR: [{ accessHash: h }, { refreshHash: h }] }, data: { revokedAt: new Date() } });
}

export async function listGrants(userId: string) {
  const rows = await db.oauthGrant.findMany({ where: { userId, revokedAt: null, refreshExpiresAt: { gt: new Date() } }, orderBy: { createdAt: "desc" }, take: 50 });
  const names = new Map((await db.oauthClient.findMany({ where: { id: { in: rows.map((r) => r.clientId) } }, select: { id: true, name: true } })).map((c) => [c.id, c.name]));
  return rows.map((r) => ({ id: r.id, name: names.get(r.clientId) ?? "An app", connectedAt: r.createdAt.toISOString(), lastUsedAt: r.lastUsedAt?.toISOString() ?? null }));
}
export async function revokeGrant(userId: string, id: string): Promise<boolean> {
  const r = await db.oauthGrant.updateMany({ where: { id, userId, revokedAt: null }, data: { revokedAt: new Date() } });
  return r.count === 1;
}
