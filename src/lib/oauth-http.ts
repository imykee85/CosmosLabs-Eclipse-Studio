import { claimUsage } from "@/lib/usage";

// Shared bits of the OAuth endpoints: the site's own address, CORS (the endpoints carry no cookies, and MCP tools in a browser call them), no-store answers and a per-address rate limit.
export const originOf = (req: Request) => new URL(req.url).origin;
export const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization, MCP-Protocol-Version", "Access-Control-Max-Age": "600" };
export const preflight = () => new Response(null, { status: 204, headers: CORS });

export function json(body: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store", Pragma: "no-cache", ...CORS, ...extra } });
}
export const oauthError = (error: string, description: string, status = 400) => json({ error, error_description: description }, status);

export function clientIp(req: Request): string {
  return (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || req.headers.get("x-real-ip") || "unknown";
}
/** True while the caller is under the limit (per address and kind). */
export const underLimit = (key: string, kind: string, limit: number, windowMs: number) => claimUsage(key, kind, limit, windowMs);

/** The request's parameters from a form body or a JSON body. */
export async function readParams(req: Request): Promise<Record<string, string>> {
  const type = req.headers.get("content-type") ?? "";
  const out: Record<string, string> = {};
  try {
    if (type.includes("application/json")) {
      const j = await req.json();
      for (const [k, v] of Object.entries(j ?? {})) if (typeof v === "string") out[k] = v;
    } else {
      const f = await req.formData();
      for (const [k, v] of f.entries()) if (typeof v === "string") out[k] = v;
    }
  } catch { /* an unreadable body is an empty one */ }
  return out;
}
