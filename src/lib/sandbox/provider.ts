// The one interface Eclipse's sandbox code talks to. Vercel Sandbox is the first provider (vercel.ts); a fake one (fake.ts) runs every test;
// E2B or Daytona can be added later behind the same shape. Paths are relative to the sandbox's working folder (/vercel/sandbox on Vercel).
// Server-side only: nothing here may be imported by a client component.

export type NetworkMode =
  | { kind: "none" }
  | { kind: "allowlist"; domains: string[] }
  | { kind: "internet" } // the internet minus private address ranges
  | { kind: "open" }; // everything, private ranges included (the sandbox's own name lookups live there): ONLY the owner's base build, a throwaway machine with nothing of ours on it

export interface SandboxSpec {
  name: string;
  vcpus: 1 | 2 | 4;
  timeoutMs: number;
  network: NetworkMode;
  base: { snapshotId?: string; image?: string };
  tags?: Record<string, string>;
}

export type CmdOpts = { cwd?: string; env?: Record<string, string>; sudo?: boolean };
export interface RunResult { exitCode: number; stdout: string; stderr: string; durationMs: number }
export interface StartedCommand { cmdId: string }
export interface CommandStatus { done: boolean; exitCode: number | null; stdoutTail: string; stderrTail: string; info?: string }
export interface SandboxUsage { activeCpuMs?: number; networkBytes?: number }

export type SandboxErrorCode = "unavailable" | "quota" | "timeout" | "not_found" | "image_not_ready" | "unknown";
export class SandboxError extends Error {
  constructor(readonly code: SandboxErrorCode, readonly retryable: boolean, readonly raw: string) {
    super(`${code}: ${raw}`.slice(0, 500));
  }
}

export interface SandboxProvider {
  id: "vercel" | "fake" | "e2b" | "daytona";
  create(spec: SandboxSpec): Promise<{ name: string; expiresAt?: Date }>;
  run(name: string, cmd: string, args: string[], opts?: CmdOpts & { timeoutMs?: number }): Promise<RunResult>;
  start(name: string, cmd: string, args: string[], opts?: CmdOpts): Promise<StartedCommand>;
  status(name: string, cmdId: string): Promise<CommandStatus>;
  kill(name: string, cmdId: string): Promise<void>;
  writeFiles(name: string, files: { path: string; content: Buffer; mode?: number }[]): Promise<void>;
  /** Small files only (summaries, logs, screenshots): anything over maxBytes is refused. Media goes through storage. */
  readFile(name: string, path: string, maxBytes: number): Promise<Buffer | null>;
  extend(name: string, ms: number): Promise<void>;
  setNetwork(name: string, network: NetworkMode): Promise<void>;
  stop(name: string): Promise<SandboxUsage>;
  /** Saves a running sandbox as a reusable base (only the owner's build-base job does this). The sandbox shuts down after. */
  snapshot?(name: string): Promise<{ snapshotId: string }>;
  deleteSnapshot?(snapshotId: string): Promise<void>;
}

/** What is kept in the database from a command's output: the last part only. */
export const OUTPUT_TAIL = 64 * 1024;
export const tail = (s: string, max = OUTPUT_TAIL) => (s.length > max ? s.slice(-max) : s);

/** Private address ranges a sandbox with "internet" access may still never reach. */
export const PRIVATE_RANGES = ["10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16", "169.254.0.0/16", "100.64.0.0/10"];

/** Every provider call gets a hard time limit, so a hung network call can never hold a step open. */
export async function withTimeout<T>(p: Promise<T>, ms: number, what: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([p, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new SandboxError("timeout", true, `${what} took longer than ${ms} ms`)), ms); })]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
