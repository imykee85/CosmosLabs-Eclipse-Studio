import { getRender } from "@/lib/api-actions";
import { withKey } from "@/lib/api-route";

export const maxDuration = 300;
export const dynamic = "force-dynamic";
// GET /api/v1/renders/<id>: one render. A running one is checked with the provider (and stored when done) on each ask.
export const GET = async (req: Request, props: { params: Promise<{ id: string }> }) => {
  const params = await props.params;
  return withKey(req, async (userId) => getRender(userId, params.id));
};
