import { SandboxError, tail, type CmdOpts, type CommandStatus, type NetworkMode, type RunResult, type SandboxProvider, type SandboxSpec, type SandboxUsage } from "./provider";

// A sandbox that lives in memory, for tests only (it refuses to load in production). Commands do not run anything: each one is answered by a
// script the test registers (`on`), which can read and write the in-memory files. It can also act out the failures the runner must survive:
// a quota refusal, a sandbox that vanished, a timeout, a slow detached command. Every call is recorded so tests can check what was sent.

export type FakeCall =
  | { op: "create"; spec: SandboxSpec }
  | { op: "run" | "start"; name: string; cmd: string; args: string[]; env?: Record<string, string>; cwd?: string; sudo?: boolean }
  | { op: "network"; name: string; network: NetworkMode }
  | { op: "write"; name: string; paths: string[] }
  | { op: "stop" | "kill" | "extend" | "read"; name: string; detail?: string };

export type FakeContext = { box: FakeBox; cmd: string; args: string[]; env: Record<string, string>; cwd: string };
export type FakeAnswer = { exitCode?: number; stdout?: string; stderr?: string; delayMs?: number; durationMs?: number };
type Handler = (c: FakeContext) => FakeAnswer | Promise<FakeAnswer>;

export type FakeBox = { name: string; spec: SandboxSpec; files: Map<string, Buffer>; network: NetworkMode; expiresAt: number; stopped: boolean; commands: Map<string, { done: number; answer: Required<Pick<FakeAnswer, "exitCode" | "stdout" | "stderr">>; killed?: boolean }> };

export class FakeSandboxProvider implements SandboxProvider {
  readonly id = "fake" as const;
  readonly boxes = new Map<string, FakeBox>();
  readonly calls: FakeCall[] = [];
  private handlers: { match: (cmd: string, args: string[]) => boolean; run: Handler }[] = [];
  private n = 0;
  /** Set to make the next create calls fail like the provider would. */
  failCreate: SandboxError | null = null;
  /** Active CPU reported when a sandbox stops. */
  cpuMsPerStop = 1500;

  constructor() {
    if (process.env.NODE_ENV === "production") throw new Error("The fake sandbox is for tests only.");
  }

  /** Answers commands whose program (or `program firstArg`) matches. Later registrations win. */
  on(match: string | ((cmd: string, args: string[]) => boolean), run: Handler) {
    const m = typeof match === "string" ? (cmd: string, args: string[]) => cmd === match || `${cmd} ${args[0] ?? ""}` === match : match;
    this.handlers.unshift({ match: m, run });
  }

  /** Makes a sandbox disappear (as if it hit its time limit or was removed by the provider). */
  vanish(name: string) { this.boxes.delete(name); }

  private box(name: string): FakeBox {
    const b = this.boxes.get(name);
    if (!b || b.stopped) throw new SandboxError("not_found", false, `sandbox ${name} not found`);
    if (Date.now() > b.expiresAt) { b.stopped = true; throw new SandboxError("not_found", false, `sandbox ${name} timed out`); }
    return b;
  }

  async create(spec: SandboxSpec) {
    this.calls.push({ op: "create", spec });
    if (this.failCreate) throw this.failCreate;
    const existing = this.boxes.get(spec.name);
    if (existing && !existing.stopped) return { name: spec.name, expiresAt: new Date(existing.expiresAt) }; // same name = attach, like the runner expects
    const b: FakeBox = { name: spec.name, spec, files: new Map(), network: spec.network, expiresAt: Date.now() + spec.timeoutMs, stopped: false, commands: new Map() };
    this.boxes.set(spec.name, b);
    return { name: spec.name, expiresAt: new Date(b.expiresAt) };
  }

  private async answer(b: FakeBox, cmd: string, args: string[], env: Record<string, string>, cwd: string) {
    const h = this.handlers.find((x) => x.match(cmd, args));
    const a = h ? await h.run({ box: b, cmd, args, env, cwd }) : { exitCode: 127, stderr: `${cmd}: command not found` };
    return { exitCode: a.exitCode ?? 0, stdout: a.stdout ?? "", stderr: a.stderr ?? "", delayMs: a.delayMs ?? 0, durationMs: a.durationMs ?? 5 };
  }

  async run(name: string, cmd: string, args: string[], opts: CmdOpts & { timeoutMs?: number } = {}): Promise<RunResult> {
    this.calls.push({ op: "run", name, cmd, args, env: opts.env, cwd: opts.cwd, sudo: opts.sudo });
    const b = this.box(name);
    const a = await this.answer(b, cmd, args, opts.env ?? {}, opts.cwd ?? "");
    if (opts.timeoutMs && a.delayMs > opts.timeoutMs) return { exitCode: 137, stdout: "", stderr: "killed: time limit", durationMs: opts.timeoutMs };
    return { exitCode: a.exitCode, stdout: a.stdout, stderr: a.stderr, durationMs: a.durationMs };
  }

  async start(name: string, cmd: string, args: string[], opts: CmdOpts = {}) {
    this.calls.push({ op: "start", name, cmd, args, env: opts.env, cwd: opts.cwd, sudo: opts.sudo });
    const b = this.box(name);
    const a = await this.answer(b, cmd, args, opts.env ?? {}, opts.cwd ?? "");
    const cmdId = `cmd_${++this.n}`;
    b.commands.set(cmdId, { done: Date.now() + a.delayMs, answer: { exitCode: a.exitCode, stdout: a.stdout, stderr: a.stderr } });
    return { cmdId };
  }

  async status(name: string, cmdId: string): Promise<CommandStatus> {
    const c = this.box(name).commands.get(cmdId);
    if (!c) throw new SandboxError("not_found", false, `command ${cmdId} not found`);
    if (c.killed) return { done: true, exitCode: 143, stdoutTail: "", stderrTail: "killed" };
    if (Date.now() < c.done) return { done: false, exitCode: null, stdoutTail: "", stderrTail: "" };
    return { done: true, exitCode: c.answer.exitCode, stdoutTail: tail(c.answer.stdout), stderrTail: tail(c.answer.stderr) };
  }

  async kill(name: string, cmdId: string) {
    this.calls.push({ op: "kill", name, detail: cmdId });
    const c = this.boxes.get(name)?.commands.get(cmdId);
    if (c) c.killed = true;
  }

  async writeFiles(name: string, files: { path: string; content: Buffer; mode?: number }[]) {
    this.calls.push({ op: "write", name, paths: files.map((f) => f.path) });
    const b = this.box(name);
    for (const f of files) b.files.set(f.path, Buffer.from(f.content));
  }

  async readFile(name: string, path: string, maxBytes: number) {
    this.calls.push({ op: "read", name, detail: path });
    const f = this.box(name).files.get(path);
    if (!f) return null;
    if (f.length > maxBytes) throw new SandboxError("unknown", false, `${path} is larger than ${maxBytes} bytes`);
    return f;
  }

  async extend(name: string, ms: number) {
    this.calls.push({ op: "extend", name, detail: String(ms) });
    this.box(name).expiresAt += ms;
  }

  async setNetwork(name: string, network: NetworkMode) {
    this.calls.push({ op: "network", name, network });
    this.box(name).network = network;
  }

  async stop(name: string): Promise<SandboxUsage> {
    this.calls.push({ op: "stop", name });
    const b = this.boxes.get(name);
    if (!b || b.stopped) return {};
    b.stopped = true;
    return { activeCpuMs: this.cpuMsPerStop, networkBytes: 2048 };
  }

  async snapshot(name: string) {
    this.box(name).stopped = true;
    return { snapshotId: `snap_fake_${++this.n}` };
  }

  async deleteSnapshot() {}
}
