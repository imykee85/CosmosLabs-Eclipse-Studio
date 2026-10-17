import { requireUser } from "@/lib/api-user";
import { frameCsp, ownTool } from "@/lib/core-tools";
import { getObjectBytes } from "@/lib/storage";

export const dynamic = "force-dynamic";

// A browser mini tool's page, shown inside a sandboxed frame on the person's own tool page. The page runs with an opaque origin (the CSP
// "sandbox" rule below applies even if this address is opened directly), so it can never read Eclipse's cookies, storage or pages; it may not
// load anything from the network (connect-src 'none') unless its owner approved internet use for this version, and only Eclipse may frame it.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const u = requireUser();
  if ("fail" in u) return new Response("Not found.", { status: 404 });
  const t = await ownTool(u.userId, params.id);
  const file = t?.kind === "browser" ? ((Array.isArray(t.files) ? t.files : []) as { path: string; key: string }[]).find((f) => f.path === t.entry) : undefined;
  if (!t || !file) return new Response("Not found.", { status: 404 });
  const html = await getObjectBytes(file.key, 1024 * 1024);
  return new Response(Buffer.from(html), {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Security-Policy": frameCsp(t.network === "internet" && t.approvedNet === t.version),
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "Cache-Control": "no-store",
      "Cross-Origin-Resource-Policy": "same-origin",
    },
  });
}
