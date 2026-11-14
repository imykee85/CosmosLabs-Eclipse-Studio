import { NextResponse } from "next/server";
import { getAdmin } from "@/lib/admin";
import { ADMIN_COOKIE, ADMIN_SESSION_MS, adminPasswordSet, passwordMatches, signAdminCookie } from "@/lib/admin-gate";
import { claimUsage } from "@/lib/usage";

// The second lock of the admin area. Only a signed-in owner account (ADMIN_EMAILS) can even try; five wrong tries lock the attempt for 15 minutes.
export async function POST(req: Request) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (!adminPasswordSet()) return NextResponse.json({ error: "No admin password is set yet. Save ADMIN_PASSWORD (at least 8 characters) in Vercel as a Secret and redeploy." }, { status: 409 });
  if (!(await claimUsage(`admin:${admin.userId}`, "login", 5, 15 * 60_000))) return NextResponse.json({ error: "Too many tries. Wait 15 minutes." }, { status: 429 });
  const body = (await req.json().catch(() => null)) as { password?: unknown } | null;
  if (typeof body?.password !== "string" || !passwordMatches(body.password)) return NextResponse.json({ error: "That password is not right." }, { status: 401 });
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, signAdminCookie(admin.userId), { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: Math.floor(ADMIN_SESSION_MS / 1000) });
  return res;
}
