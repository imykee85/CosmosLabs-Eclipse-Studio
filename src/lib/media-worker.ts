// Client for the Eclone media worker (worker/ in this repo): sends a tool and its arguments with signed storage links, polls the job.
// Env (Secrets): MEDIA_WORKER_URL (the worker's address) and MEDIA_WORKER_SECRET (shared secret). Without them the feature says it is not set up.
import { signedGetUrl, signedPutUrl } from "@/lib/storage";

export const WORKER_TOOLS = ["probe", "prep", "frame", "check", "finish", "versions", "split", "assemble"] as const;
export type WorkerTool = (typeof WORKER_TOOLS)[number];
export type WorkerJob = { id: string; state: "queued" | "running" | "done" | "failed"; error?: string; stderr?: string };

type Fetcher = typeof fetch;

export function workerConfigured(): boolean {
  return !!process.env.MEDIA_WORKER_URL && !!process.env.MEDIA_WORKER_SECRET;
}

// `inputs` and `outputs` name storage keys; the worker receives only signed links, never our bucket credentials.
export async function startWorkerJob(args: {
  tool: WorkerTool; args: string[]; inputs: Record<string, string>; outputs: Record<string, { key: string; contentType: string }>;
}, fetcher: Fetcher = fetch): Promise<WorkerJob> {
  if (!workerConfigured()) throw new Error("worker-not-set-up");
  const inputs = Object.fromEntries(await Promise.all(Object.entries(args.inputs).map(async ([n, key]) => [n, await signedGetUrl(key, 900)])));
  const outputs = Object.fromEntries(await Promise.all(Object.entries(args.outputs).map(async ([n, o]) => [n, { url: await signedPutUrl(o.key, o.contentType), contentType: o.contentType }])));
  const res = await fetcher(`${process.env.MEDIA_WORKER_URL!.replace(/\/$/, "")}/jobs`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.MEDIA_WORKER_SECRET}` },
    body: JSON.stringify({ tool: args.tool, args: args.args, inputs, outputs }),
  });
  if (res.status !== 202) throw new Error(`worker-refused-${res.status}`);
  return (await res.json()) as WorkerJob;
}

export async function getWorkerJob(id: string, fetcher: Fetcher = fetch): Promise<WorkerJob> {
  if (!/^[0-9a-f]{32}$/.test(id)) throw new Error("bad-job-id");
  const res = await fetcher(`${process.env.MEDIA_WORKER_URL!.replace(/\/$/, "")}/jobs/${id}`, { headers: { Authorization: `Bearer ${process.env.MEDIA_WORKER_SECRET}` } });
  if (!res.ok) throw new Error(`worker-status-${res.status}`);
  return (await res.json()) as WorkerJob;
}
