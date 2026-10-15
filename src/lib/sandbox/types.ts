// The one interface Core's sandbox code talks to. A concrete provider (E2B, Modal, a VPS...) is chosen by the owner and sits behind
// it; nothing outside src/lib/sandbox knows which. Paths are inside the sandbox and always under /work.
export type ExecResult = { exitCode: number | null; stdout: string; stderr: string; timedOut: boolean; durationMs: number };
export type FileEntry = { path: string; size: number };

export interface SandboxProvider {
  readonly name: string;
  /** Makes a fresh sandbox for one person and returns its id. */
  start(userId: string): Promise<string>;
  exec(sandboxId: string, cmd: string, opts: { timeoutMs: number; cwd?: string }): Promise<ExecResult>;
  readFile(sandboxId: string, path: string): Promise<Uint8Array>;
  writeFile(sandboxId: string, path: string, data: Uint8Array | string): Promise<void>;
  listFiles(sandboxId: string, dir: string): Promise<FileEntry[]>;
  /** A PNG of a local page (path or URL inside the sandbox) at one width, taken with the sandbox's own browser. */
  screenshot(sandboxId: string, target: string, width: number): Promise<Uint8Array>;
  destroy(sandboxId: string): Promise<void>;
}
