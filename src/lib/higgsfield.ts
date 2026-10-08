// Thin wrapper around the Higgsfield platform API. Raw prompt in, image URL out.
// Base URL, model and auth scheme are isolated here so they are easy to adjust.
// Shape follows the public docs as found through search (docs.higgsfield.ai and
// open.higgsfield.ai are not reachable from the build sandbox). Confirmed live for
// Soul 2 only; the other models in image-models.ts are unverified. POST /<model path> with `Authorization: Key <key>`,
// answer carries request_id / status_url, poll GET /requests/<id>/status until
// status is "completed" (images[0].url) or a terminal failure.

import { getModel, nearestRatio } from "./image-models";

const BASE_URL = process.env.HIGGSFIELD_BASE_URL ?? "https://platform.higgsfield.ai";
const POLL_INTERVAL_MS = 2000;
const TIMEOUT_MS = 55_000;

type JobResponse = {
  status?: string;
  request_id?: string;
  status_url?: string;
  images?: { url: string }[];
  image?: { url: string };
};

function headers() {
  const key = process.env.HIGGSFIELD_API_KEY;
  if (!key) throw new Error("HIGGSFIELD_API_KEY is not set");
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    Authorization: `Key ${key}`,
  };
}

function extractUrl(job: JobResponse): string | undefined {
  return job.images?.[0]?.url ?? job.image?.url;
}

// Carries Higgsfield's own reply so the route can tell the user what was rejected.
export class HiggsfieldError extends Error {
  constructor(message: string, readonly detail?: string) { super(message); }
}

export async function generateImage(prompt: string, aspectRatio?: string, modelId?: string): Promise<string> {
  const model = getModel(modelId);
  const envKey = model.id.toUpperCase();
  const path = process.env[`HIGGSFIELD_PATH_${envKey}`] ?? process.env.HIGGSFIELD_MODEL_PATH ?? model.path;
  const resolution = process.env[`HIGGSFIELD_RESOLUTION_${envKey}`] ?? model.resolution;
  const ratio = aspectRatio ? nearestRatio(model, aspectRatio) : undefined;

  const res = await fetch(`${BASE_URL}/${path}`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ prompt, ...(resolution ? { resolution } : {}), ...(ratio ? { aspect_ratio: ratio } : {}) }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new HiggsfieldError(`Higgsfield request failed (${res.status}) for ${model.id}: ${text}`, `${res.status}: ${text.slice(0, 200)}`);
  }

  let job = (await res.json()) as JobResponse;
  if (!job.status_url && !job.request_id) throw new Error("Higgsfield returned no request id");
  const statusUrl = job.status_url ?? `${BASE_URL}/requests/${job.request_id}/status`;
  const deadline = Date.now() + TIMEOUT_MS;

  while (!extractUrl(job)) {
    if (job.status === "failed" || job.status === "nsfw" || job.status === "canceled" || job.status === "cancelled") {
      throw new Error(`Higgsfield generation ${job.status}`);
    }
    if (Date.now() > deadline) throw new Error("Higgsfield generation timed out");
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    const poll = await fetch(statusUrl, { headers: headers() });
    if (!poll.ok) throw new Error(`Higgsfield status check failed (${poll.status})`);
    job = (await poll.json()) as JobResponse;
  }
  return extractUrl(job)!;
}
