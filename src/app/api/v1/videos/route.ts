import { createVideo } from "@/lib/api-actions";
import { readJson, withKey } from "@/lib/api-route";

export const maxDuration = 60;
// POST /api/v1/videos { prompt, model, duration, resolution?, aspect_ratio?, sound?, seed?, negative_prompt?, start_frame?, end_frame?, reference_images?, reference_videos?, confirm?, project_id? }
// Starts one video and returns it as "pending". A dear video answers 409 { needs_confirm, cost } until it is sent again with confirm: true.
export const POST = (req: Request) => withKey(req, async (userId) => createVideo(userId, await readJson(req)));
