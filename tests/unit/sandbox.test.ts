import test from "node:test";
import assert from "node:assert/strict";
import { execFile, execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { APIError } from "@vercel/sandbox";
import { VercelSandboxProvider, mapError, toPolicy } from "../../src/lib/sandbox/vercel";
import { PRIVATE_RANGES, SandboxError } from "../../src/lib/sandbox/provider";
import { MUX_SH } from "../../src/lib/sandbox/kinds/mux";
import { cleanSchema, frameCsp } from "../../src/lib/core-tools";
import { sessionPath } from "../../src/lib/sandbox/core-session";

// ---- The Vercel adapter, against a stand-in for the SDK (no network).
type Recorded = { create?: Record<string, unknown>; get: Record<string, unknown>[]; update?: Record<string, unknown>; commands: Record<string, unknown>[] };
function sdk(status = "running", rec: Recorded = { get: [], commands: [] }) {
  const box = {
    name: "job_1", expiresAt: new Date(), status, activeCpuUsageMs: 900, networkTransfer: { ingress: 10, egress: 5 },
    runCommand: async (p: Record<string, unknown>) => { rec.commands.push(p); return p.detached ? { cmdId: "cmd_9" } : { exitCode: 0, durationMs: 4, stdout: async () => "out", stderr: async () => "" }; },
    getCommand: async () => ({ exitCode: 3, stdout: async () => "x".repeat(70_000), stderr: async () => "bad" }),
    update: async (p: Record<string, unknown>) => { rec.update = p; },
    stop: async () => ({ activeCpuDurationMs: 1234, networkTransfer: { ingress: 100, egress: 50 } }),
    writeFiles: async () => {}, readFileToBuffer: async () => Buffer.from("{}"), extendTimeout: async () => {}, snapshot: async () => ({ snapshotId: "snap_9" }),
  };
  return {
    rec,
    sdk: {
      create: async (p: Record<string, unknown>) => { rec.create = p; return box as never; },
      get: async (p: Record<string, unknown>) => { rec.get.push(p); return box as never; },
      deleteSnapshot: async () => {},
    },
  };
}

test("vercel: network modes map to the SDK's policies; private ranges are always denied for internet", () => {
  assert.equal(toPolicy({ kind: "none" }), "deny-all");
  assert.deepEqual(toPolicy({ kind: "allowlist", domains: ["acct.r2.cloudflarestorage.com"] }), { allow: ["acct.r2.cloudflarestorage.com"] });
  assert.equal(toPolicy({ kind: "allowlist", domains: [] }), "deny-all");
  assert.deepEqual(toPolicy({ kind: "internet" }), { subnets: { deny: PRIVATE_RANGES } });
  assert.ok(PRIVATE_RANGES.includes("169.254.0.0/16") && PRIVATE_RANGES.includes("100.64.0.0/10"));
});

test("vercel: create boots the snapshot, never persists, sets the region and tags; without a snapshot it uses the image", async () => {
  let s = sdk();
  await new VercelSandboxProvider(s.sdk as never, "iad1", "vercel/sandbox/universal:latest").create({ name: "job_1", vcpus: 2, timeoutMs: 60_000, network: { kind: "none" }, base: { snapshotId: "snap_1" }, tags: { kind: "media.mux" } });
  assert.deepEqual(s.rec.create?.source, { type: "snapshot", snapshotId: "snap_1" });
  assert.equal(s.rec.create?.persistent, false);
  assert.equal(s.rec.create?.networkPolicy, "deny-all");
  assert.equal(s.rec.create?.region, "iad1");
  assert.deepEqual(s.rec.create?.resources, { vcpus: 2 });
  assert.deepEqual(s.rec.create?.tags, { app: "eclipse", kind: "media.mux" });
  assert.equal(s.rec.create?.env, undefined); // a sandbox never gets environment variables from us
  s = sdk();
  await new VercelSandboxProvider(s.sdk as never, "iad1", "vercel/sandbox/universal:latest").create({ name: "job_2", vcpus: 2, timeoutMs: 60_000, network: { kind: "internet" }, base: {} });
  assert.equal(s.rec.create?.image, "vercel/sandbox/universal:latest");
  assert.equal(s.rec.create?.source, undefined);
});

test("vercel: a stopped sandbox is never resumed: every call loads it with resume false and refuses unless it runs", async () => {
  const s = sdk("stopped");
  const p = new VercelSandboxProvider(s.sdk as never);
  await assert.rejects(p.run("job_1", "node", ["-v"]), (e: unknown) => e instanceof SandboxError && e.code === "not_found");
  await assert.rejects(p.status("job_1", "cmd_1"), (e: unknown) => e instanceof SandboxError && e.code === "not_found");
  assert.ok(s.rec.get.every((g) => g.resume === false));
  assert.equal(s.rec.commands.length, 0);
  const usage = await p.stop("job_1"); // stopping a stopped sandbox only reads its numbers
  assert.deepEqual(usage, { activeCpuMs: 900, networkBytes: 15 });
});

test("vercel: start is detached, status keeps only the tail of the output, stop reports CPU and transfer, network updates", async () => {
  const s = sdk();
  const p = new VercelSandboxProvider(s.sdk as never);
  assert.deepEqual(await p.start("job_1", "bash", ["mux.sh"], { sudo: true }), { cmdId: "cmd_9" });
  assert.equal(s.rec.commands[0].detached, true);
  assert.equal(s.rec.commands[0].sudo, true);
  const st = await p.status("job_1", "cmd_9");
  assert.equal(st.done, true); assert.equal(st.exitCode, 3); assert.equal(st.stdoutTail.length, 64 * 1024); assert.equal(st.stderrTail, "bad");
  await p.setNetwork("job_1", { kind: "none" });
  assert.deepEqual(s.rec.update, { networkPolicy: "deny-all" });
  assert.deepEqual(await p.stop("job_1"), { activeCpuMs: 1234, networkBytes: 150 });
});

test("vercel: SDK errors become our codes (quota, not found, busy, image not ready)", () => {
  const api = (status: number, text: string) => new APIError(new Response(text, { status }), { message: text, text });
  assert.equal(mapError(api(402, "payment required")).code, "quota");
  assert.equal(mapError(api(429, "sandbox creation paused: usage limit exceeded")).code, "quota");
  assert.equal(mapError(api(429, "too many requests")).code, "unavailable");
  assert.equal(mapError(api(404, "not found")).code, "not_found");
  assert.equal(mapError(api(410, "gone")).code, "not_found");
  assert.equal(mapError(api(500, "oops")).retryable, true);
  assert.equal(mapError(new Error("image_not_ready: still building")).code, "image_not_ready");
  assert.equal(mapError(new Error("something else")).code, "unknown");
});

// ---- The mux script itself, run for real with bash, curl and ffmpeg against a local file server (skipped where ffmpeg is missing).
const hasTools = ["ffmpeg", "ffprobe", "curl", "bash"].every((t) => spawnSync("sh", ["-c", `command -v ${t}`]).status === 0);
async function serve(files: Record<string, Buffer>) {
  const puts: Record<string, Buffer> = {};
  const server: Server = createServer((req, res) => {
    if (req.method === "PUT") { const c: Buffer[] = []; req.on("data", (d) => c.push(d)); req.on("end", () => { puts[req.url!] = Buffer.concat(c); res.end(); }); return; }
    const f = files[req.url!]; if (!f) { res.statusCode = 404; return void res.end(); } res.end(f);
  });
  const port = await new Promise<number>((ok) => server.listen(0, "127.0.0.1", () => ok((server.address() as { port: number }).port)));
  return { base: `http://127.0.0.1:${port}`, puts, close: () => server.close() };
}
function media(dir: string) {
  const ff = (args: string[]) => execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...args], { cwd: dir });
  ff(["-f", "lavfi", "-i", "testsrc=duration=3:size=160x120:rate=12", "-f", "lavfi", "-i", "sine=frequency=300:duration=3", "-shortest", "-pix_fmt", "yuv420p", "-c:v", "libx264", "-c:a", "aac", "with-sound.mp4"]);
  ff(["-f", "lavfi", "-i", "testsrc=duration=3:size=160x120:rate=12", "-pix_fmt", "yuv420p", "-c:v", "libx264", "silent.mp4"]);
  ff(["-f", "lavfi", "-i", "sine=frequency=880:duration=5", "sound.wav"]);
  return { withSound: readFileSync(join(dir, "with-sound.mp4")), silent: readFileSync(join(dir, "silent.mp4")), sound: readFileSync(join(dir, "sound.wav")) };
}
const probe = (file: string) => JSON.parse(execFileSync("ffprobe", ["-v", "error", "-show_entries", "stream=codec_type,codec_name:format=duration", "-of", "json", file]).toString()) as { streams: { codec_type: string; codec_name: string }[]; format: { duration: string } };

test("mux.sh: replace keeps the picture as is, puts in the new sound (AAC) and stops at the shorter; mix falls back when the clip is silent", { skip: hasTools ? false : "ffmpeg/curl not installed" }, async () => {
  const dir = mkdtempSync(join(tmpdir(), "mux-"));
  const m = media(dir);
  const srv = await serve({ "/v.mp4": m.withSound, "/s.mp4": m.silent, "/a.wav": m.sound });
  try {
    for (const [video, mode, want] of [["/v.mp4", "replace", "replace"], ["/v.mp4", "mix", "mix"], ["/s.mp4", "mix", "replace"]] as const) {
      const work = mkdtempSync(join(tmpdir(), "mux-run-"));
      writeFileSync(join(work, "mux.sh"), MUX_SH);
      // Run without blocking: the file server lives in this same process.
      const r = await new Promise<{ status: number; stdout: string; stderr: string }>((ok) => execFile("bash", ["mux.sh", `${srv.base}${video}`, `${srv.base}/a.wav`, `${srv.base}/out-${mode}${video.slice(1, 2)}`, mode, "-3"], { cwd: work, encoding: "utf8" }, (err, stdout, stderr) => ok({ status: err ? Number((err as { code?: number }).code ?? 1) : 0, stdout, stderr })));
      assert.equal(r.status, 0, r.stderr);
      assert.ok(!r.stdout.includes(srv.base) && !r.stderr.includes(srv.base), "the script never prints a link");
      assert.equal(JSON.parse(readFileSync(join(work, "result.json"), "utf8")).mode, want);
      const out = srv.puts[`/out-${mode}${video.slice(1, 2)}`];
      assert.ok(out && out.length > 1000);
      writeFileSync(join(work, "got.mp4"), out);
      const p = probe(join(work, "got.mp4"));
      assert.equal(p.streams.find((s) => s.codec_type === "video")?.codec_name, "h264"); // copied, not re-encoded
      assert.equal(p.streams.find((s) => s.codec_type === "audio")?.codec_name, "aac");
      assert.ok(Number(p.format.duration) < 3.6, `stops with the video (${p.format.duration})`);
      assert.ok(existsSync(join(work, "probe.json")));
    }
  } finally { srv.close(); }
});

// ---- Mini tools: the browser tool's frame rules, the form description and paths inside a build session.
test("browser tools run sandboxed with an opaque origin and no network unless approved; only Eclipse may frame them", () => {
  const csp = frameCsp(false);
  assert.match(csp, /^sandbox allow-scripts allow-downloads allow-forms allow-modals;/);
  assert.ok(!csp.includes("allow-same-origin"));
  assert.match(csp, /connect-src 'none'/);
  assert.match(csp, /default-src 'none'/);
  assert.match(csp, /frame-ancestors 'self'/);
  assert.match(frameCsp(true), /connect-src https:/);
});

test("the tool form description is checked and cleaned", () => {
  assert.equal(typeof cleanSchema({ fields: [{ name: "Bad Name", type: "text" }] }), "string");
  assert.equal(typeof cleanSchema({ fields: [{ name: "a", type: "rocket" }] }), "string");
  assert.equal(typeof cleanSchema({ fields: [{ name: "c", type: "select", options: [] }] }), "string");
  const ok = cleanSchema({ fields: [{ name: "size", label: "Size", type: "number", min: 1, max: 4000 }, { name: "clips", type: "file", accept: [".WAV", "nope"], multiple: true }] });
  assert.ok(typeof ok !== "string");
  if (typeof ok !== "string") {
    assert.equal(ok.fields[0].type, "number");
    assert.deepEqual((ok.fields[1] as { accept?: string[] }).accept, [".wav"]);
  }
  assert.deepEqual(cleanSchema(undefined), { fields: [] });
});

test("build-session paths stay inside the working folder", () => {
  assert.equal(sessionPath("tool/main.js"), "tool/main.js");
  assert.equal(sessionPath("/vercel/sandbox/out/a.png"), "out/a.png");
  assert.equal(sessionPath("./x"), "x");
  assert.equal(sessionPath("../etc/passwd"), null);
  assert.equal(sessionPath("/etc/passwd"), null);
  assert.equal(sessionPath("a/../../b"), null);
});
