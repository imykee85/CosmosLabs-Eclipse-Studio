import { createHmac, timingSafeEqual } from "node:crypto";

// The homepage pictures and clips (/landing, /hero, /carousel) only load for a browser that has just opened one of our pages. Opening a page hands the browser a signed cookie
// that lasts a few hours; the media folders refuse a request without a valid one (src/proxy.ts). So a file address copied out of the page stops working for anyone else
// (curl, another site embedding it, a saved link) and for the same browser once the cookie has run out. It cannot stop someone who has the page open: the browser must receive a
// file to show it. Switch: MEDIA_GATE=on (always), off (never); unset = on for preview builds only, until it has been tried on a real iPhone.
export const MEDIA_COOKIE = "eclipse-media";
export const MEDIA_TTL = 4 * 3600;
const RENEW_BELOW = 30 * 60;

const secret = () => process.env.CONNECT_SECRET_KEY || process.env.CLERK_SECRET_KEY || "dev-only-not-secret";
const mac = (exp: string) => createHmac("sha256", secret()).update(`media:${exp}`).digest("base64url").slice(0, 32);

export const gatedMediaPath = (path: string) => /^\/(landing|hero|carousel)\//.test(path);

export function mediaGateOn(): boolean {
  const v = process.env.MEDIA_GATE;
  if (v === "off") return false;
  if (v === "on") return true;
  return process.env.VERCEL_ENV === "preview";
}

export function mediaCookieValue(nowMs = Date.now()): string {
  const exp = String(Math.floor(nowMs / 1000) + MEDIA_TTL);
  return `${exp}.${mac(exp)}`;
}

/** Seconds left on a cookie, or 0 when it is missing, altered or out of date. */
export function mediaCookieLeft(value: string | undefined, nowMs = Date.now()): number {
  if (!value) return 0;
  const [exp, tag] = value.split(".");
  if (!exp || !tag || !/^\d{1,12}$/.test(exp)) return 0;
  const want = Buffer.from(mac(exp)), got = Buffer.from(tag);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return 0;
  return Math.max(0, Number(exp) - Math.floor(nowMs / 1000));
}

export const mediaCookieNeedsRenewal = (value: string | undefined, nowMs = Date.now()) => mediaCookieLeft(value, nowMs) < RENEW_BELOW;
