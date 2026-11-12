import { NextResponse } from "next/server";
import { ADMIN_COOKIE } from "@/lib/admin-gate";

// Ends the admin session on this browser (the cookie is simply cleared; it is useless on its own without the owner's sign-in).
export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: 0 });
  return res;
}
