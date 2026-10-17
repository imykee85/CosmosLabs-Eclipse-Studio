import { listModels } from "@/lib/api-actions";
import { withKey } from "@/lib/api-route";

export const dynamic = "force-dynamic";
// GET /api/v1/models: the image and video models this account can use, with what each accepts.
export const GET = (req: Request) => withKey(req, async () => listModels());
