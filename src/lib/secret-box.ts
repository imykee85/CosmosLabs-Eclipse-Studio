import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

// Credentials people give us (a bot token, a webhook address) are stored encrypted, never in the clear. The key comes from
// CONNECT_SECRET_KEY, or else from CLERK_SECRET_KEY so it works with the keys already set; change either and old links must be re-added.
function key(): Buffer {
  const base = process.env.CONNECT_SECRET_KEY || process.env.CLERK_SECRET_KEY;
  if (!base) throw new Error("No secret key is set to protect stored credentials (CONNECT_SECRET_KEY).");
  return createHash("sha256").update(`eclipse-connect:${base}`).digest();
}

export function seal(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), enc].map((b) => b.toString("base64")).join(".");
}

export function unseal(box: string): string {
  const [iv, tag, enc] = box.split(".").map((p) => Buffer.from(p, "base64"));
  const d = createDecipheriv("aes-256-gcm", key(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(enc), d.final()]).toString("utf8");
}
