import { registerClient } from "@/lib/oauth";
import { clientIp, json, oauthError, preflight, underLimit } from "@/lib/oauth-http";

export const dynamic = "force-dynamic";

// RFC 7591 dynamic client registration: an app (Claude) registers itself and its redirect addresses, then sends the person to /oauth/authorize. Public clients only (no secret).
export async function POST(req: Request) {
  if (!(await underLimit(`ip:${clientIp(req)}`, "oauth-register", 30, 3600_000))) return oauthError("temporarily_unavailable", "Too many registrations from this address. Try again later.", 429);
  const b = await req.json().catch(() => null);
  if (!b || typeof b !== "object") return oauthError("invalid_client_metadata", "Send the client metadata as JSON.");
  const r = await registerClient(b as Record<string, unknown>);
  if (!r.ok) return oauthError(r.error, r.description);
  return json({ ...r.client, grant_types: ["authorization_code", "refresh_token"], response_types: ["code"], token_endpoint_auth_method: "none", client_id_issued_at: Math.floor(Date.now() / 1000) }, 201);
}
export const OPTIONS = preflight;
