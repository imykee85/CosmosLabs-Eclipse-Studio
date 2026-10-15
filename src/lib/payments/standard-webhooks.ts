import { createHmac, timingSafeEqual } from "node:crypto";
import { InvalidWebhookError } from "./types";

// Verifies a delivery signed the "Standard Webhooks" way: HMAC-SHA256 over `${id}.${timestamp}.${body}`, sent in the headers
// webhook-id, webhook-timestamp and webhook-signature ("v1,<base64>", possibly several separated by spaces).
// Anything that does not verify is rejected, so a provider that signs differently fails closed instead of letting forged events in.

const TOLERANCE_SECONDS = 300;

function key(secret: string): Buffer {
  return secret.startsWith("whsec_") ? Buffer.from(secret.slice("whsec_".length), "base64") : Buffer.from(secret, "utf8");
}

export function verifyStandardWebhook(rawBody: string, headers: Headers, secret: string, nowSeconds = Math.floor(Date.now() / 1000)): void {
  const id = headers.get("webhook-id");
  const timestamp = headers.get("webhook-timestamp");
  const signatures = headers.get("webhook-signature");
  if (!id || !timestamp || !signatures) throw new InvalidWebhookError("Missing signature headers");

  const sent = Number(timestamp);
  if (!Number.isFinite(sent) || Math.abs(nowSeconds - sent) > TOLERANCE_SECONDS) throw new InvalidWebhookError("Timestamp outside the allowed window");

  const expected = createHmac("sha256", key(secret)).update(`${id}.${timestamp}.${rawBody}`).digest();
  const matches = signatures.split(" ").some((part) => {
    const [version, value] = part.split(",");
    if (version !== "v1" || !value) return false;
    const given = Buffer.from(value, "base64");
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
  if (!matches) throw new InvalidWebhookError("Signature does not match");
}
