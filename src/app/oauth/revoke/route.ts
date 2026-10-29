import { getClient, revokeToken } from "@/lib/oauth";
import { json, oauthError, preflight, readParams } from "@/lib/oauth-http";

export const dynamic = "force-dynamic";

// RFC 7009: an app ends its own connection. Answers 200 whether or not the token existed.
export async function POST(req: Request) {
  const p = await readParams(req);
  const client = await getClient(p.client_id);
  if (!client) return oauthError("invalid_client", "Unknown client_id.", 401);
  if (p.token && p.token.length <= 200) await revokeToken(p.token, client.id);
  return json({});
}
export const OPTIONS = preflight;
