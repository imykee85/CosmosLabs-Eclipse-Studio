import { CORS, json, originOf, preflight } from "@/lib/oauth-http";

export const dynamic = "force-dynamic";

// RFC 9728: tells an MCP client that /api/mcp is protected and which server signs people in. Served at the root address and at the path-suffixed address clients try.
export function GET(req: Request) {
  const o = originOf(req);
  return json({ resource: `${o}/api/mcp`, resource_name: "Eclipse Studio", authorization_servers: [o], bearer_methods_supported: ["header"], scopes_supported: ["eclipse"] }, 200, { "Cache-Control": "public, max-age=300", ...CORS });
}
export const OPTIONS = preflight;
