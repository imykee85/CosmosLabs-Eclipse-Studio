import { gateFeatureFor } from "@/lib/access";
import { authenticateKey, type KeyAuth } from "@/lib/api-keys";
import { authenticateOauth } from "@/lib/oauth";
import { claimUsage } from "@/lib/usage";

/** Who an MCP request acts for: an app signed in through "Sign in with Eclipse" (token starting eca_) or a personal API key (ecl_). Both get the same plan check and the same rate limit. */
export async function authenticateMcp(req: Request): Promise<KeyAuth & { oauth?: boolean; presented?: boolean }> {
  const h = req.headers.get("authorization") ?? "";
  const token = /^Bearer\s+(\S+)$/.exec(h)?.[1];
  if (!token) return { ok: false, status: 401, error: "Sign in with Eclipse to use this server, or send an API key as: Authorization: Bearer ecl_..." };
  if (!token.startsWith("eca_")) return { ...(await authenticateKey(req)), presented: true };
  const t = await authenticateOauth(token);
  if (!t) return { ok: false, status: 401, error: "That sign-in has expired or was disconnected. Connect Eclipse again.", presented: true };
  const allowed = await gateFeatureFor(t.userId, "api");
  if (!allowed.ok) return { ok: false, status: 402, error: allowed.body.error, presented: true };
  const rpm = Number(process.env.API_RPM) > 0 ? Math.floor(Number(process.env.API_RPM)) : 60;
  if (!(await claimUsage(t.userId, `api:oauth:${t.grantId}`, rpm, 60_000))) return { ok: false, status: 429, error: `Too many requests: up to ${rpm} a minute.`, presented: true };
  return { ok: true, userId: t.userId, keyId: t.grantId, oauth: true };
}
