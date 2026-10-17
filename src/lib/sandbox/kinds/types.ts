import type { SandboxJob } from "@prisma/client";
import type { z } from "zod";
import type { NetworkMode, SandboxProvider } from "../provider";

// One kind of sandbox job. A job is a list of stages; each stage is one command the runner starts detached and polls until it ends. Stages are
// built when they start (not stored), so the signed storage links they carry are made fresh and never land in the database or the logs.

export const WORK = "/vercel/sandbox"; // the sandbox's working folder; files are written relative to it

export type StageResult = { exitCode: number; stdout: string; stderr: string };
export type StageCtx = { job: SandboxJob; provider: SandboxProvider; name: string; results: StageResult[] };

export type Stage = {
  name: string;
  /** Applied before this stage's command starts. */
  network?: NetworkMode;
  files?: { path: string; content: Buffer; mode?: number }[];
  cmd: string;
  args: string[];
  env?: Record<string, string>;
  sudo?: boolean;
  /** The args carry signed links: the audit log records the command without them. */
  secretArgs?: boolean;
  /** Run before the command (blocking, short): used to stop leftover processes before the network opens again. */
  before?: { cmd: string; args: string[] };
  /** A non-zero exit does not fail the job (the next stage or collect decides). */
  allowFail?: boolean;
};

/** `failed` ends the job as failed but keeps the output (smoke keeps its check list that way). */
export type Finished = { output: Record<string, unknown>; charge?: number; failed?: string };

export interface KindDef<I = Record<string, unknown>> {
  kind: string;
  /** Validates the input the server built (never raw browser input). */
  schema: z.ZodType<I>;
  vcpus: 1 | 2 | 4;
  deadlineMs: number;
  /** The network the sandbox starts with. */
  network: (input: I) => NetworkMode;
  /** "image" boots the plain managed image (build-base); "snapshot" boots our prepared base, falling back to the image only when allowed. */
  base: "snapshot" | "image";
  imageFallback?: boolean;
  /** Credits held when the job is queued (only when charging is on). */
  price: (input: I) => number;
  /** A session job (Core build session) has no stages: it stays running until stopped. */
  session?: boolean;
  stageCount?: (input: I) => number;
  stage?: (ctx: StageCtx, i: number, input: I) => Promise<Stage>;
  /** After the last stage succeeded: read the small summary and say what the person gets. */
  collect?: (ctx: StageCtx, input: I) => Promise<Finished>;
  /** build-base saves the sandbox as a snapshot instead of stopping it. */
  snapshotAtEnd?: boolean;
  /** The plain sentence a person sees when a stage fails (admins see the stderr too). */
  failMessage: string;
  /** Charge for a session, from how long it ran. */
  sessionCharge?: (job: SandboxJob) => number;
  /** After the job settled (any status): build-base records the new snapshot, smoke retires the old one. */
  onFinished?: (job: SandboxJob) => Promise<void>;
  /** What the person's page gets from the output: signed download links are made here, fresh on every read, never stored. */
  present?: (output: Record<string, unknown>, job: SandboxJob) => Promise<Record<string, unknown>>;
}

export class JobInputError extends Error {}
