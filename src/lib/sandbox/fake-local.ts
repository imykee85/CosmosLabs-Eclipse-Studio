import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomBytes } from "node:crypto";
import type { ExecResult, FileEntry, SandboxProvider } from "./types";

// A stand-in provider for tests: a temporary folder on this machine as /work, commands run with a scrubbed environment and a hard
// timeout. It is NOT a security boundary (a command can still read the machine's files), so it refuses to start in production.
export class FakeLocalProvider implements SandboxProvider {
  readonly name = "fake-local";
  private boxes = new Map<string, { userId: string; root: string }>();

  private box(id: string) {
    const b = this.boxes.get(id);
    if (!b) throw new Error("No such sandbox.");
    return b;
  }
  /** Maps a sandbox path to the real one, refusing anything that is not under /work. */
  private real(id: string, p: string): string {
    const root = this.box(id).root;
    const clean = path.posix.normalize(`/${p}`);
    if (clean !== "/work" && !clean.startsWith("/work/")) throw new Error("Path must be under /work.");
    return path.join(root, clean);
  }

  async start(userId: string): Promise<string> {
    if (process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production") throw new Error("The fake sandbox is for tests only.");
    const id = `fake-${randomBytes(6).toString("hex")}`;
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "sbx-"));
    await fs.mkdir(path.join(root, "work"), { recursive: true });
    this.boxes.set(id, { userId, root });
    return id;
  }

  async exec(id: string, cmd: string, opts: { timeoutMs: number; cwd?: string }): Promise<ExecResult> {
    const started = Date.now();
    const cwd = this.real(id, opts.cwd ?? "/work");
    return new Promise((resolve) => {
      // Only a bare PATH, no Eclipse keys, database address or tokens.
      // The sandbox's /work is a folder here, so absolute /work paths in a command are pointed at it.
      const local = cmd.replaceAll("/work", path.join(this.box(id).root, "work"));
      const child = spawn("sh", ["-c", local], { cwd, env: { PATH: process.env.PATH ?? "/usr/bin:/bin", HOME: this.box(id).root, LANG: "C.UTF-8" } as unknown as NodeJS.ProcessEnv, detached: true, stdio: ["ignore", "pipe", "pipe"] });
      let stdout = "", stderr = "", timedOut = false;
      const cap = (s: string, d: Buffer) => (s.length > 200_000 ? s : s + d.toString("utf8"));
      child.stdout.on("data", (d) => (stdout = cap(stdout, d)));
      child.stderr.on("data", (d) => (stderr = cap(stderr, d)));
      const timer = setTimeout(() => { timedOut = true; try { process.kill(-child.pid!, "SIGKILL"); } catch {} }, opts.timeoutMs);
      child.on("close", (code) => { clearTimeout(timer); resolve({ exitCode: timedOut ? null : code, stdout, stderr, timedOut, durationMs: Date.now() - started }); });
      child.on("error", (e) => { clearTimeout(timer); resolve({ exitCode: null, stdout, stderr: String(e), timedOut, durationMs: Date.now() - started }); });
    });
  }

  async readFile(id: string, p: string) { return new Uint8Array(await fs.readFile(this.real(id, p))); }
  async writeFile(id: string, p: string, data: Uint8Array | string) {
    const r = this.real(id, p);
    await fs.mkdir(path.dirname(r), { recursive: true });
    await fs.writeFile(r, data);
  }
  async listFiles(id: string, dir: string): Promise<FileEntry[]> {
    const base = this.real(id, dir), out: FileEntry[] = [];
    const root = this.box(id).root;
    async function walk(d: string) {
      for (const e of await fs.readdir(d, { withFileTypes: true }).catch(() => [])) {
        const full = path.join(d, e.name);
        if (e.isDirectory()) await walk(full);
        else if (e.isFile()) out.push({ path: "/" + path.relative(root, full).split(path.sep).join("/"), size: (await fs.stat(full)).size });
      }
    }
    await walk(base);
    return out;
  }
  async screenshot(): Promise<Uint8Array> { throw new Error("The fake sandbox has no browser."); }
  async destroy(id: string) {
    const b = this.boxes.get(id);
    if (!b) return;
    this.boxes.delete(id);
    await fs.rm(b.root, { recursive: true, force: true });
  }
  has(id: string) { return this.boxes.has(id); }
}
