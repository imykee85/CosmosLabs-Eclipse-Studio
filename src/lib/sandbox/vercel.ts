import { APIError, Sandbox, Snapshot, StreamError } from "@vercel/sandbox";
import { PRIVATE_RANGES, SandboxError, tail, withTimeout, type CmdOpts, type NetworkMode, type SandboxProvider, type SandboxSpec, type SandboxUsage } from "./provider";

// Vercel Sandbox (package @vercel/sandbox, pinned 3.8.0). On Vercel deployments the SDK signs in with the project's OIDC token by itself, so there
// is no key to keep. Facts read from the SDK's own typings (2026-10-17):
// - A call on a sandbox whose session has stopped makes the SDK RESUME it (it treats HTTP 410 as "start a new session"). A throwaway job must never
//   be silently restarted, so every call first loads the sandbox WITHOUT resuming and refuses unless its session is "running".
// - `stop()` returns the session's activeCpuDurationMs and networkTransfer {ingress, egress} for the usage table.
// - Network policies: "deny-all", { allow: [domains] } (everything else denied), { subnets: { deny } }. Header-injection rules are never used.

type Sdk = {
  create: (p: Parameters<typeof Sandbox.create>[0]) => Promise<Sandbox>;
  get: (p: Parameters<typeof Sandbox.get>[0]) => Promise<Sandbox>;
  deleteSnapshot: (snapshotId: string) => Promise<void>;
};
const realSdk: Sdk = {
  create: (p) => Sandbox.create(p),
  get: (p) => Sandbox.get(p),
  deleteSnapshot: async (snapshotId) => { await (await Snapshot.get({ snapshotId })).delete(); },
};

const CALL_MS = 25_000; // every control-plane call; each runner step stays well under a function's limit

export function toPolicy(n: NetworkMode): "deny-all" | { allow: string[] } | { subnets: { deny: string[] } } {
  if (n.kind === "none") return "deny-all";
  if (n.kind === "allowlist") return n.domains.length ? { allow: n.domains } : "deny-all";
  return { subnets: { deny: PRIVATE_RANGES } };
}

/** Turns whatever the SDK threw into one of our codes. The raw text is kept for the admin log only. */
export function mapError(err: unknown): SandboxError {
  if (err instanceof SandboxError) return err;
  const raw = err instanceof Error ? err.message : String(err);
  const text = `${raw} ${err instanceof APIError ? (err.text ?? JSON.stringify(err.json ?? "")) : ""}`.toLowerCase();
  if (/image_not_ready/.test(text)) return new SandboxError("image_not_ready", true, raw);
  if (err instanceof StreamError) return new SandboxError("not_found", false, raw);
  const status = err instanceof APIError ? err.response.status : 0;
  if (status === 404 || status === 410 || /not_found/.test(text)) return new SandboxError("not_found", false, raw);
  // The exact refusal after the Hobby allowance is used up is not documented in what we read: a 402, or a 403/429 that talks about limits or
  // usage, is treated as the allowance (the job waits and retries later); other 429s are a plain "busy, retry".
  if (status === 402 || ((status === 403 || status === 429) && /quota|limit|usage|exceed|paused|billing|allowance/.test(text))) return new SandboxError("quota", true, raw);
  if (status === 429 || status >= 500) return new SandboxError("unavailable", true, raw);
  if (status === 401 || status === 403) return new SandboxError("unavailable", false, raw);
  if (/timed? ?out|aborted/.test(text)) return new SandboxError("timeout", true, raw);
  return new SandboxError("unknown", false, raw);
}

export class VercelSandboxProvider implements SandboxProvider {
  readonly id = "vercel" as const;
  constructor(private readonly sdk: Sdk = realSdk, private readonly region = process.env.SANDBOX_REGION || "iad1", private readonly fallbackImage = process.env.SANDBOX_BASE_IMAGE || "vercel/sandbox/universal:latest") {}

  private async call<T>(what: string, fn: () => Promise<T>, ms = CALL_MS): Promise<T> {
    try { return await withTimeout(fn(), ms, what); } catch (err) { throw mapError(err); }
  }

  /** The sandbox, only while its session runs (never resumed). */
  private async live(name: string): Promise<Sandbox> {
    const sb = await this.call("get", () => this.sdk.get({ name, resume: false }));
    let status: string | undefined;
    try { status = sb.status; } catch { status = undefined; }
    if (status !== "running") throw new SandboxError("not_found", false, `sandbox ${name} is ${status ?? "gone"}`);
    return sb;
  }

  async create(spec: SandboxSpec) {
    const common = { name: spec.name, resources: { vcpus: spec.vcpus }, timeout: spec.timeoutMs, networkPolicy: toPolicy(spec.network), persistent: false, region: this.region as never, tags: { app: "eclipse", ...spec.tags } };
    const params = spec.base.snapshotId ? { ...common, source: { type: "snapshot" as const, snapshotId: spec.base.snapshotId } } : { ...common, image: spec.base.image || this.fallbackImage };
    try {
      const sb = await withTimeout(this.sdk.create(params as Parameters<typeof Sandbox.create>[0]), 60_000, "create");
      return { name: sb.name, expiresAt: sb.expiresAt };
    } catch (err) {
      // Repeating a create step must attach to the sandbox the first try made. The answer to a duplicate name is not documented: on a 409 (or a
      // message about the name), look it up and attach when it is running.
      const status = err instanceof APIError ? err.response.status : 0;
      if (status === 409 || /already exists|conflict|name.*taken/i.test(err instanceof Error ? err.message : "")) {
        const sb = await this.live(spec.name);
        return { name: sb.name, expiresAt: sb.expiresAt };
      }
      throw mapError(err);
    }
  }

  async run(name: string, cmd: string, args: string[], opts: CmdOpts & { timeoutMs?: number } = {}) {
    const sb = await this.live(name);
    const limit = opts.timeoutMs ?? 20_000;
    const r = await this.call("run", async () => {
      const done = await sb.runCommand({ cmd, args, cwd: opts.cwd, env: opts.env, sudo: opts.sudo, timeoutMs: limit });
      const [stdout, stderr] = await Promise.all([done.stdout(), done.stderr()]);
      return { exitCode: done.exitCode, stdout: tail(stdout), stderr: tail(stderr), durationMs: done.durationMs ?? 0 };
    }, limit + 5000);
    return r;
  }

  async start(name: string, cmd: string, args: string[], opts: CmdOpts = {}) {
    const sb = await this.live(name);
    const c = await this.call("start", () => sb.runCommand({ cmd, args, cwd: opts.cwd, env: opts.env, sudo: opts.sudo, detached: true }));
    return { cmdId: c.cmdId };
  }

  async status(name: string, cmdId: string) {
    const sb = await this.live(name);
    let c = await this.call("status", () => sb.getCommand(cmdId));
    // A command that has finished should already carry its exit code; if it does not, ask the service to wait a moment for it (short: this runs inside a poll).
    if ((c.exitCode === null || c.exitCode === undefined) && typeof (c as { wait?: unknown }).wait === "function") {
      const ac = new AbortController();
      const timer = setTimeout(() => ac.abort(), 2500);
      try { const fin = await (c as unknown as { wait(p: { signal: AbortSignal }): Promise<typeof c> }).wait({ signal: ac.signal }); if (fin) c = fin; } catch { /* still running: that is the normal answer */ } finally { clearTimeout(timer); }
    }
    if (c.exitCode === null || c.exitCode === undefined) {
      const started = (c as { startedAt?: number }).startedAt;
      return { done: false, exitCode: null, stdoutTail: "", stderrTail: "", info: `command ${cmdId.slice(-6)} running${started ? ` for ${Math.round((Date.now() - started) / 1000)} s` : ""}, no exit code yet` };
    }
    const [stdout, stderr] = await this.call("output", () => Promise.all([c.stdout(), c.stderr()]));
    return { done: true, exitCode: c.exitCode, stdoutTail: tail(stdout), stderrTail: tail(stderr) };
  }

  async kill(name: string, cmdId: string) {
    const sb = await this.live(name).catch(() => null);
    if (!sb) return;
    await this.call("kill", async () => { await (await sb.getCommand(cmdId)).kill("SIGTERM"); }).catch(() => {});
  }

  async writeFiles(name: string, files: { path: string; content: Buffer; mode?: number }[]) {
    const sb = await this.live(name);
    await this.call("write", () => sb.writeFiles(files.map((f) => ({ path: f.path, content: f.content, mode: f.mode }))));
  }

  async readFile(name: string, path: string, maxBytes: number) {
    const sb = await this.live(name);
    // Size first, so a large file is refused without pulling it through this function.
    const size = await this.call("stat", async () => {
      const r = await sb.runCommand({ cmd: "stat", args: ["-c", "%s", path], timeoutMs: 10_000 });
      return r.exitCode === 0 ? Number((await r.stdout()).trim()) : -1;
    });
    if (size < 0) return null;
    if (size > maxBytes) throw new SandboxError("unknown", false, `${path} is ${size} bytes, over the ${maxBytes} limit`);
    return this.call("read", () => sb.readFileToBuffer({ path }));
  }

  async extend(name: string, ms: number) {
    const sb = await this.live(name);
    await this.call("extend", () => sb.extendTimeout(ms));
  }

  async setNetwork(name: string, network: NetworkMode) {
    const sb = await this.live(name);
    await this.call("network", () => sb.update({ networkPolicy: toPolicy(network) }));
  }

  async stop(name: string): Promise<SandboxUsage> {
    let sb: Sandbox;
    try { sb = await this.call("get", () => this.sdk.get({ name, resume: false })); } catch (err) {
      if (err instanceof SandboxError && err.code === "not_found") return {};
      throw err;
    }
    let running = false;
    try { running = sb.status === "running" || sb.status === "pending"; } catch { running = false; }
    if (!running) return { activeCpuMs: sb.activeCpuUsageMs, networkBytes: sb.networkTransfer ? sb.networkTransfer.ingress + sb.networkTransfer.egress : undefined };
    const s = await this.call("stop", () => sb.stop());
    const net = s.networkTransfer ?? sb.networkTransfer;
    return { activeCpuMs: s.activeCpuDurationMs ?? sb.activeCpuUsageMs, networkBytes: net ? net.ingress + net.egress : undefined };
  }

  async snapshot(name: string) {
    const sb = await this.live(name);
    const snap = await this.call("snapshot", () => sb.snapshot({ expiration: 0 }), 120_000);
    return { snapshotId: snap.snapshotId };
  }

  async deleteSnapshot(snapshotId: string) {
    await this.call("delete snapshot", () => this.sdk.deleteSnapshot(snapshotId));
  }
}
