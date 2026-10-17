import type { SandboxJob } from "@prisma/client";
import { kindDef } from "./kinds";

// What a page gets about a job: never the input (it holds storage keys) or the runner's state. Signed download links are made fresh here.
export type JobView = {
  id: string; kind: string; status: string; message: string | null; createdAt: string; finishedAt: string | null; creditsCharged: number;
  output: Record<string, unknown> | null; error: { code: string; message: string; detail?: string } | null;
};

export async function jobView(job: SandboxJob, admin = false): Promise<JobView> {
  const def = kindDef(job.kind);
  const raw = job.output && typeof job.output === "object" && !Array.isArray(job.output) ? (job.output as Record<string, unknown>) : null;
  let output: Record<string, unknown> | null = null;
  if (raw && job.status === "succeeded") output = def?.present ? await def.present(raw, job).catch(() => null) : raw;
  else if (raw && admin) output = raw;
  const e = job.error && typeof job.error === "object" ? (job.error as { code?: string; message?: string; detail?: string }) : null;
  return {
    id: job.id, kind: job.kind, status: job.status, message: job.message, createdAt: job.createdAt.toISOString(), finishedAt: job.finishedAt?.toISOString() ?? null, creditsCharged: job.creditsCharged,
    output, error: e ? { code: e.code ?? "error", message: e.message ?? "The job did not finish.", ...(admin && e.detail ? { detail: e.detail } : {}) } : null,
  };
}
