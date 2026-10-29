import { CORS, json, originOf, preflight } from "@/lib/oauth-http";

export const dynamic = "force-dynamic";

// RFC 8414: how an MCP client finds Eclipse's sign-in (authorization code with PKCE, apps register themselves, no client secret).
export function GET(req: Request) {
  const o = originOf(req);
  return json({
    issuer: o,
    authorization_endpoint: `${o}/oauth/authorize`,
    token_endpoint: `${o}/oauth/token`,
    registration_endpoint: `${o}/oauth/register`,
    revocation_endpoint: `${o}/oauth/revoke`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    revocation_endpoint_auth_methods_supported: ["none"],
    scopes_supported: ["eclipse"],
  }, 200, { "Cache-Control": "public, max-age=300", ...CORS });
}
export const OPTIONS = preflight;
