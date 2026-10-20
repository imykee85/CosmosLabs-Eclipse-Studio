import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { claimUsage } from "@/lib/usage";

export const runtime = "nodejs";

// Browsers post a short note here when the page security policy blocks (or, in report mode, would block) something. Public by nature, so it is small:
// a size cap, a per-address limit, only a few short fields kept (never full addresses with query strings) and only the newest 300 rows.
const KEEP = 300;
const clip = (v: unknown, n: number) => (typeof v === "string" ? v : "").slice(0, n);
// Keep scheme and host (or the keyword browsers send, like "inline" or "eval"), drop paths and queries.
function place(v: unknown): string {
  const t = clip(v, 300);
  try {
    const u = new URL(t);
    return `${u.protocol}//${u.host}`.slice(0, 120);
  } catch {
    return t.slice(0, 40);
  }
}

export async function POST(req: Request) {
  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";
  if (!(await claimUsage(`csp:${ip}`, "csp-report", 30, 60_000).catch(() => false))) return new NextResponse(null, { status: 204 });
  const text = await req.text().catch(() => "");
  if (!text || text.length > 8_000) return new NextResponse(null, { status: 204 });
  let body: unknown;
  try { body = JSON.parse(text); } catch { return new NextResponse(null, { status: 204 }); }
  // Two formats: {"csp-report": {...}} (report-uri) and [{type: "csp-violation", body: {...}}] (Reporting API).
  const list = Array.isArray(body) ? body.map((r) => (r as { body?: unknown })?.body) : [(body as { "csp-report"?: unknown })?.["csp-report"]];
  const rows = list.slice(0, 5).flatMap((r) => {
    const o = (r ?? {}) as Record<string, unknown>;
    const directive = clip(o["effective-directive"] ?? o["effectiveDirective"] ?? o["violated-directive"] ?? o["violatedDirective"], 60);
    if (!directive) return [];
    return [{
      directive,
      blocked: place(o["blocked-uri"] ?? o["blockedURL"] ?? o["blockedUri"]),
      page: clip(o["document-uri"] ?? o["documentURL"], 300).replace(/[?#].*$/, "").replace(/^https?:\/\/[^/]+/, "").slice(0, 80) || "/",
      sample: clip(o["script-sample"] ?? o["sample"], 40) || null,
    }];
  });
  if (rows.length) {
    await db.cspReport.createMany({ data: rows }).catch(() => undefined);
    const old = await db.cspReport.findMany({ orderBy: { createdAt: "desc" }, skip: KEEP, take: 1, select: { createdAt: true } }).catch(() => []);
    if (old[0]) await db.cspReport.deleteMany({ where: { createdAt: { lte: old[0].createdAt } } }).catch(() => undefined);
  }
  return new NextResponse(null, { status: 204 });
}
