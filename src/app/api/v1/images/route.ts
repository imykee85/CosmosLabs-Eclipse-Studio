import { createImage } from "@/lib/api-actions";
import { readJson, withKey } from "@/lib/api-route";

export const maxDuration = 300;
// POST /api/v1/images { prompt, model, aspect_ratio?, resolution?, references?: [{ type: "upload"|"render", id }], seed?, project_id? }
// Starts one image and returns it as "pending"; GET /api/v1/renders/<id> until it is "completed" (its `url` is a short-lived link).
export const POST = (req: Request) => withKey(req, async (userId) => createImage(userId, await readJson(req)));
