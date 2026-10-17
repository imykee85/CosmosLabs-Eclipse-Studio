import { NextResponse } from "next/server";
import { authenticateKey } from "@/lib/api-keys";
import type { ApiResult } from "@/lib/api-actions";

// The public API's door: a valid key, then the action; errors come back as { error } with the right status. Never cached.
export async function withKey(req: Request, run: (userId: string) => Promise<ApiResult>): Promise<NextResponse> {
  try {
    const a = await authenticateKey(req);
    if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status, headers: { "Cache-Control": "no-store" } });
    const r = await run(a.userId);
    if (!r.ok) return NextResponse.json({ error: r.error, ...(r.extra ?? {}) }, { status: r.status, headers: { "Cache-Control": "no-store" } });
    return NextResponse.json(r.data, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("public API failed", err);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
export const readJson = async (req: Request): Promise<Record<string, unknown>> => { const b = await req.json().catch(() => null); return b && typeof b === "object" && !Array.isArray(b) ? b : {}; };
