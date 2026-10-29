import { exchangeCode, getClient, refreshGrant } from "@/lib/oauth";
import { json, oauthError, preflight, readParams, underLimit } from "@/lib/oauth-http";

export const dynamic = "force-dynamic";

// The token endpoint: swaps the one-time code (with the PKCE verifier) for an access and a refresh token, and swaps a refresh token for a new pair.
export async function POST(req: Request) {
  const p = await readParams(req);
  const client = await getClient(p.client_id);
  if (!client) return oauthError("invalid_client", "Unknown client_id.", 401);
  if (!(await underLimit(`client:${client.id}`, "oauth-token", 120, 60_000))) return oauthError("temporarily_unavailable", "Too many requests. Slow down.", 429);
  if (p.grant_type === "authorization_code") {
    if (!p.code || !p.redirect_uri || !p.code_verifier) return oauthError("invalid_request", "code, redirect_uri and code_verifier are required.");
    const r = await exchangeCode({ code: p.code, clientId: client.id, redirectUri: p.redirect_uri, verifier: p.code_verifier });
    return r.ok ? json(r.body) : oauthError(r.error, r.description);
  }
  if (p.grant_type === "refresh_token") {
    if (!p.refresh_token) return oauthError("invalid_request", "refresh_token is required.");
    const r = await refreshGrant({ refreshToken: p.refresh_token, clientId: client.id });
    return r.ok ? json(r.body) : oauthError(r.error, r.description);
  }
  return oauthError("unsupported_grant_type", "Use authorization_code or refresh_token.");
}
export const OPTIONS = preflight;
