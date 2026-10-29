import { NextResponse } from "next/server";
import { authenticateMcp } from "@/lib/mcp-auth";
import { handleRpc } from "@/lib/mcp";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

// POST /api/mcp: the MCP endpoint (Streamable HTTP, JSON answers, no server-held session). Authorization: Bearer eca_... (an app signed in through "Sign in with Eclipse", src/lib/oauth.ts) or Bearer ecl_... (a personal key from Settings > API/MCP).
// A single message or a batch; notifications get 202 with no body. GET is not offered (no server-sent stream).
export async function POST(req: Request) {
  const a = await authenticateMcp(req);
  if (!a.ok) {
    // A 401 tells an MCP client where to sign in (RFC 9728): it fetches the resource metadata, then starts the sign-in flow.
    const meta = `${new URL(req.url).origin}/.well-known/oauth-protected-resource`;
    const challenge = `Bearer realm="eclipse", resource_metadata="${meta}"${a.presented && a.status === 401 ? ', error="invalid_token"' : ""}`;
    return NextResponse.json({ jsonrpc: "2.0", id: null, error: { code: -32001, message: a.error } }, { status: a.status, headers: { "WWW-Authenticate": challenge } });
  }
  const body = await req.json().catch(() => undefined);
  if (body === undefined) return NextResponse.json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }, { status: 400 });
  try {
    if (Array.isArray(body)) {
      const out = (await Promise.all(body.slice(0, 20).map((m) => handleRpc(a.userId, m)))).filter(Boolean);
      return out.length ? NextResponse.json(out) : new NextResponse(null, { status: 202 });
    }
    const out = await handleRpc(a.userId, body);
    return out ? NextResponse.json(out) : new NextResponse(null, { status: 202 });
  } catch (err) {
    console.error("mcp failed", err);
    return NextResponse.json({ jsonrpc: "2.0", id: (body as { id?: unknown })?.id ?? null, error: { code: -32603, message: "Internal error" } }, { status: 500 });
  }
}
export function GET() { return new NextResponse(null, { status: 405, headers: { Allow: "POST" } }); }
