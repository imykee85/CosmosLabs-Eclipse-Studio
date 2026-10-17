import { credits } from "@/lib/api-actions";
import { withKey } from "@/lib/api-route";

export const dynamic = "force-dynamic";
// GET /api/v1/credits: the account's credit balance.
export const GET = (req: Request) => withKey(req, async (userId) => credits(userId));
