import { createHmac, timingSafeEqual } from "node:crypto";
import { signedGetUrl } from "./storage";

// Eclipse-branded media links (owner 2026-10-19: every link people see is Eclipse's own, never the storage service's address).
// A share link is /s/<token>: the render id and an expiry, signed with our secret, so it opens without signing in until it expires
// and cannot be altered. The bytes are streamed from private storage through our own address (range requests pass through, so videos seek).
const secret = () => process.env.CONNECT_SECRET_KEY || process.env.CLERK_SECRET_KEY || "dev-only-not-secret";
const b64 = (s: string) => Buffer.from(s).toString("base64url");
const sig = (body: string) => createHmac("sha256", secret()).update(`share:${body}`).digest("base64url").slice(0, 32);

export function shareToken(id: string, days: number): string {
  const body = b64(`${id}.${Math.floor(Date.now() / 1000) + days * 86400}`);
  return `${body}.${sig(body)}`;
}
export function readShareToken(token: string): { id: string } | null {
  const [body, mac] = token.split(".");
  if (!body || !mac) return null;
  const want = Buffer.from(sig(body)), got = Buffer.from(mac);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  const [id, exp] = Buffer.from(body, "base64url").toString().split(".");
  if (!id || !/^[\w-]{1,64}$/.test(id) || !(Number(exp) > Date.now() / 1000)) return null;
  return { id };
}

// Streams a stored file to the browser from our own address, passing a Range request through.
export async function streamStored(req: Request, key: string, contentType: string, opts: { download?: string; cache?: string } = {}): Promise<Response> {
  const range = req.headers.get("range");
  const upstream = await fetch(await signedGetUrl(key, 600), { headers: range ? { Range: range } : {} });
  if (!upstream.ok && upstream.status !== 206) return new Response("Could not read the file.", { status: upstream.status === 416 ? 416 : 502 });
  const headers = new Headers({ "Content-Type": contentType, "Accept-Ranges": "bytes", "Cache-Control": opts.cache ?? "private, max-age=300" });
  for (const h of ["content-length", "content-range", "etag", "last-modified"]) { const v = upstream.headers.get(h); if (v) headers.set(h, v); }
  if (opts.download) headers.set("Content-Disposition", `attachment; filename="${opts.download.replace(/["\\\r\n]/g, "")}"`);
  return new Response(upstream.body, { status: upstream.status, headers });
}
