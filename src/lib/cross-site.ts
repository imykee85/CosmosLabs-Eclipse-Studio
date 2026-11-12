// A second wall against cross-site writes: a browser always sends an Origin header on a cross-site POST, PUT, PATCH or DELETE. If it is there and is
// not this site's own address, the request is refused. Server-to-server calls (payment and sign-up webhooks, cron, hand-overs, the MCP endpoint and the
// OAuth endpoints, which other services call) carry no browser Origin or are exempt by path. The session cookie's SameSite setting already helps; this does not depend on it.
const EXEMPT = [/^\/api\/payments\/webhook$/, /^\/api\/webhooks\//, /^\/api\/mcp(\/|$)/, /^\/oauth\//, /^\/\.well-known\//, /^\/api\/cron\//, /^\/api\/plans\/[^/]+\/continue$/, /^\/api\/agent\/missions\/[^/]+\/continue$/, /^\/api\/csp-report$/];

export function crossSiteWrite(method: string, pathname: string, origin: string | null, host: string | null): boolean {
  if (!/^(POST|PUT|PATCH|DELETE)$/i.test(method) || !pathname.startsWith("/api/")) return false;
  if (!origin || EXEMPT.some((r) => r.test(pathname))) return false;
  try { return new URL(origin).host !== host; } catch { return true; }
}
