import { listRenders } from "@/lib/api-actions";
import { withKey } from "@/lib/api-route";

export const dynamic = "force-dynamic";
// GET /api/v1/renders?limit=20&kind=image|video&project_id=: the newest renders, newest first.
export const GET = (req: Request) => withKey(req, async (userId) => { const q = new URL(req.url).searchParams; return listRenders(userId, { limit: q.get("limit"), kind: q.get("kind"), project_id: q.get("project_id") ?? undefined }); });
