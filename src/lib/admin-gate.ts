import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getAdmin } from "@/lib/admin";
import { serverSecret } from "@/lib/server-secret";

// The owner's admin area has TWO locks: (1) the signed-in account must be one of ADMIN_EMAILS (getAdmin), and (2) the owner must have entered the admin
// password (Secret ADMIN_PASSWORD). The password check sets a signed, httpOnly cookie bound to that account that lasts 12 hours.
// While ADMIN_PASSWORD is not set the second lock is off (so setting it up never locks the owner out) and the dashboard says so.

export const ADMIN_COOKIE = "eclipse-admin";
export const ADMIN_SESSION_MS = 12 * 3600_000;
const secret = () => serverSecret(process.env.CONNECT_SECRET_KEY, process.env.CLERK_SECRET_KEY);
const mac = (userId: string, exp: number) => createHmac("sha256", secret()).update(`admin|${userId}|${exp}`).digest("base64url");

export const adminPasswordSet = (): boolean => Boolean(process.env.ADMIN_PASSWORD && process.env.ADMIN_PASSWORD.length >= 8);

export function signAdminCookie(userId: string, now = Date.now()): string {
  const exp = now + ADMIN_SESSION_MS;
  return `${userId}.${exp}.${mac(userId, exp)}`;
}
/** The account the cookie was issued to, or null when it is missing, forged, expired or malformed. */
export function verifyAdminCookie(value: string | undefined | null, now = Date.now()): string | null {
  if (!value) return null;
  const parts = value.split(".");
  if (parts.length !== 3) return null;
  const [userId, expText, sig] = parts;
  const exp = Number(expText);
  if (!userId || !Number.isFinite(exp) || exp < now) return null;
  const want = Buffer.from(mac(userId, exp)), got = Buffer.from(sig);
  return want.length === got.length && timingSafeEqual(want, got) ? userId : null;
}
/** Compares in constant time (both sides hashed first so the lengths match). */
export function passwordMatches(given: string): boolean {
  const real = process.env.ADMIN_PASSWORD;
  if (!real || !adminPasswordSet() || typeof given !== "string") return false;
  const a = createHash("sha256").update(given).digest(), b = createHash("sha256").update(real).digest();
  return timingSafeEqual(a, b);
}

/** True when the browser holds a valid admin cookie (does not look at who is signed in). */
export async function hasAdminCookie(): Promise<boolean> {
  return verifyAdminCookie((await cookies()).get(ADMIN_COOKIE)?.value) !== null;
}

/** For API routes: the admin when BOTH locks are open, else null (callers answer 401 or 403 as before). */
export async function getAdminSession(): Promise<{ userId: string; email: string } | null> {
  const admin = await getAdmin();
  if (!admin) return null;
  if (!adminPasswordSet()) return admin;
  return verifyAdminCookie((await cookies()).get(ADMIN_COOKIE)?.value) === admin.userId ? admin : null;
}

/** For admin pages: the admin, null when the person is not an admin at all, or a redirect to the password screen when only the password is missing. */
export async function requireAdminPage(): Promise<{ userId: string; email: string } | null> {
  const admin = await getAdmin();
  if (!admin) return null;
  if (!adminPasswordSet()) return admin;
  if (verifyAdminCookie((await cookies()).get(ADMIN_COOKIE)?.value) === admin.userId) return admin;
  redirect("/admin/login");
}
