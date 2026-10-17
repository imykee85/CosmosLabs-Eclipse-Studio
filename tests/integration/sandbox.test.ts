// The sandbox platform against a throwaway Postgres, the in-memory fake sandbox and a fake R2 (no real keys, no real sandbox).
// Run: DATABASE_URL=postgresql://postgres@localhost:5444/jobs npm run test:integration   (skips itself when DATABASE_URL is not set)
import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { createServer, type IncomingMessage, type Server } from "node:http";

const skip = process.env.DATABASE_URL ? false : "DATABASE_URL not set";
const U1 = "user_sbx_a", U2 = "user_sbx_b", ADMIN = "user_sbx_admin";
const objects = new Map<string, Buffer>();
const body = (req: IncomingMessage) => new Promise<Buffer>((res) => { const c: Buffer[] = []; req.on("data", (d) => c.push(d)); req.on("end", () => res(Buffer.concat(c))); });
let r2: Server;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let L: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let fake: any;

before(async () => {
  if (skip) return;
  r2 = createServer(async (req, res) => {
    const path = decodeURIComponent((req.url ?? "").split("?")[0]);
    if (req.method === "PUT") { objects.set(path, await body(req)); res.setHeader("etag", '"x"'); return void res.end(); }
    if (req.method === "DELETE") { objects.delete(path); res.statusCode = 204; return void res.end(); }
    const o = objects.get(path); if (!o) { res.statusCode = 404; return void res.end(); }
    res.setHeader("content-length", String(o.length)); res.setHeader("content-type", "application/octet-stream");
    if (req.method === "HEAD") return void res.end();
    res.end(o);
  });
  const port = await new Promise<number>((ok) => r2.listen(0, "127.0.0.1", () => ok((r2.address() as { port: number }).port)));
  Object.assign(process.env, { R2_ENDPOINT: `http://127.0.0.1:${port}`, R2_ACCOUNT_ID: "acct", R2_ACCESS_KEY_ID: "AKIDTEST", R2_SECRET_ACCESS_KEY: "r2-secret-value-xyz", R2_BUCKET: "bkt", CREDITS_ENABLED: "1", SANDBOX_MUX: "on", SANDBOX_PROVIDER: "fake", SANDBOX_JOBS_PER_DAY: "1000", SANDBOX_BASE_SNAPSHOT_ID: "" });
  L = {
    db: (await import("../../src/lib/db")).db, runner: await import("../../src/lib/sandbox/runner"), sb: await import("../../src/lib/sandbox"), fake: await import("../../src/lib/sandbox/fake"),
    mux: await import("../../src/lib/sandbox/kinds/mux"), credits: await import("../../src/lib/credits"), session: await import("../../src/lib/sandbox/core-session"), tools: await import("../../src/lib/core-tools"),
    usage: await import("../../src/lib/sandbox/usage"), view: await import("../../src/lib/sandbox/view"), storage: await import("../../src/lib/storage"),
  };
  await clean();
});
const USERS = [U1, U2, ADMIN];
async function clean() {
  for (const m of ["sandboxJob", "sandboxAudit", "creditLedger", "usageEvent", "generation", "audioJob", "coreTool"]) await L.db[m].deleteMany({ where: { userId: { in: USERS } } });
  await L.db.sandboxUsageMonth.deleteMany({});
  await L.db.sandboxSetting.deleteMany({});
}
after(async () => { if (skip) return; await clean(); await L.db.$disconnect(); r2.close(); });

const put = (key: string, b: Buffer) => objects.set(`/bkt/${key}`, b);
const got = (key: string) => objects.get(`/bkt/${key}`);
async function reset(opts: { paid?: boolean; credits?: number } = {}) {
  await clean();
  objects.clear();
  fake = new L.fake.FakeSandboxProvider();
  L.sb.setSandboxProvider(fake);
  await L.sb.setSetting(L.sb.SETTING.snapshot, "snap_base_1");
  if (opts.paid !== false) await L.credits.grantCredits(U1, opts.credits ?? 100, { reason: "PURCHASE", provider: "test", externalId: `p_${Math.random()}` });
  delete process.env.SANDBOX_MAX_CONCURRENT;
  delete process.env.SANDBOX_KILL_SWITCH;
}
const balance = (u = U1) => L.credits.getBalance(u);

/** A finished video and a Mirelo "sound for video" take with two variants, owned by `user`. */
async function takeFor(user: string) {
  const g = await L.db.generation.create({ data: { userId: user, prompt: "clip", imageUrl: "", status: "completed", kind: "video", storageKey: `u/${user}/v.mp4`, contentType: "video/mp4" } });
  put(`u/${user}/v.mp4`, Buffer.from("VIDEO"));
  const a = await L.db.audioJob.create({ data: { userId: user, kind: "vsfx", model: "sfx-2.0", provider: "mirelo", text: "", textHash: "h", chars: 0, status: "completed", storageKey: `audio/${user}/t/variant-1.wav`, contentType: "audio/wav",
    params: { videoId: g.id }, result: { variants: [{ key: `audio/${user}/t/variant-1.wav`, mime: "audio/wav", sizeBytes: 5, durationMs: 1000 }, { key: `audio/${user}/t/variant-2.wav`, mime: "audio/wav", sizeBytes: 5, durationMs: 1000 }] } } });
  put(`audio/${user}/t/variant-2.wav`, Buffer.from("AUDIO2"));
  return { videoId: g.id, takeId: a.id };
}
/** The fake's answer to mux.sh: writes the summary files and uploads the result to the signed link (third argument), as the real script does. */
function muxAnswers(opts: { exit?: number; delayMs?: number } = {}) {
  fake.on("bash mux.sh", async ({ box, args }: { box: { files: Map<string, Buffer> }; args: string[] }) => {
    if (opts.exit) return { exitCode: opts.exit, stderr: "ffmpeg: Invalid data found when processing input" };
    const r = await fetch(args[3], { method: "PUT", body: "MUXED-MP4", headers: { "Content-Type": "video/mp4" } });
    assert.equal(r.status, 200);
    box.files.set("probe.json", Buffer.from(JSON.stringify({ format: { duration: "10.0" } })));
    box.files.set("result.json", Buffer.from(JSON.stringify({ mode: args[4] })));
    return { exitCode: 0, stdout: "done", delayMs: opts.delayMs ?? 0 };
  });
}
async function startMux(user = U1, variant = 2) {
  const { takeId } = await takeFor(user);
  const id = `sbxtest${Math.random().toString(36).slice(2, 12)}`;
  const input = await L.mux.muxInputFor(user, id, { audioJobId: takeId, variant });
  return L.runner.enqueue("media.mux", user, input, { id });
}

test("media.mux: merges the chosen variant, uploads through a signed link, charges once, stops the sandbox", { skip }, async () => {
  await reset();
  muxAnswers();
  const q = await startMux();
  assert.equal(q.ok, true);
  const job = await L.runner.drive(q.job.id, 10_000, 10);
  assert.equal(job.status, "succeeded", JSON.stringify(job.error));
  assert.equal(job.creditsCharged, 5);
  assert.equal(await balance(), 95);
  assert.equal(got(`u/${U1}/mux/${q.job.id}.mp4`)?.toString(), "MUXED-MP4");
  const create = fake.calls.find((c: { op: string }) => c.op === "create");
  assert.deepEqual(create.spec.network, { kind: "allowlist", domains: ["127.0.0.1"] }); // only the storage host
  assert.deepEqual(create.spec.base, { snapshotId: "snap_base_1" });
  assert.ok(fake.calls.some((c: { op: string }) => c.op === "stop"));
  const start = fake.calls.find((c: { op: string; cmd?: string }) => c.op === "start");
  assert.match(start.args[1], /variant-1|v\.mp4/); // the video link
  assert.match(start.args[2], /variant-2\.wav/); // the chosen variant, not variant 1
  // The audit never stores the signed links.
  const audit = await L.db.sandboxAudit.findMany({ where: { jobId: q.job.id } });
  assert.ok(audit.length >= 3);
  for (const a of audit) assert.ok(!(a.command ?? "").includes("X-Amz") && !(a.command ?? "").includes("http"), a.command);
  assert.ok(audit.some((a: { command: string | null }) => a.command === "bash [6 arguments hidden]"));
  const view = await L.view.jobView(job);
  assert.match(view.output.url, /mux/);
  assert.equal(view.output.key, undefined); // never the storage key
  assert.equal(view.output.durationSec, 10);
  // Driving a finished job again changes nothing and charges nothing more.
  await L.runner.advance(q.job.id);
  assert.equal(await balance(), 95);
});

test("media.mux: a failing ffmpeg ends as failed, charges nothing, still stops the sandbox; people see a short message only", { skip }, async () => {
  await reset();
  muxAnswers({ exit: 1 });
  const q = await startMux();
  const job = await L.runner.drive(q.job.id, 10_000, 10);
  assert.equal(job.status, "failed");
  assert.equal(job.creditsCharged, 0);
  assert.equal(await balance(), 100);
  assert.ok(fake.calls.some((c: { op: string }) => c.op === "stop"));
  const v = await L.view.jobView(job), va = await L.view.jobView(job, true);
  assert.equal(v.error.detail, undefined);
  assert.match(va.error.detail, /Invalid data/);
  assert.match(v.error.message, /Nothing was charged/);
});

test("another person's take, or a take whose video is gone, is refused before anything is queued", { skip }, async () => {
  await reset();
  const { takeId, videoId } = await takeFor(U2);
  await assert.rejects(L.mux.muxInputFor(U1, "sbxx", { audioJobId: takeId }), /not found/);
  const mine = await takeFor(U1);
  await L.db.generation.update({ where: { id: mine.videoId }, data: { deletedAt: new Date() } });
  await assert.rejects(L.mux.muxInputFor(U1, "sbxx", { audioJobId: mine.takeId }), /no longer in your Library/);
  assert.ok(videoId);
  assert.equal(await L.db.sandboxJob.count({ where: { userId: { in: [U1, U2] } } }), 0);
});

test("guards: unpaid plans, one open job per person, the kill switch, 95 percent of the allowance, and the credit hold", { skip }, async () => {
  await reset({ paid: false });
  await L.credits.grantCredits(U1, 50, { reason: "GRANT" });
  let r = await startMux();
  assert.equal(r.ok, false); assert.equal(r.status, 402); assert.match(r.error, /paid plans/);
  await reset();
  muxAnswers({ delayMs: 60_000 });
  const first = await startMux();
  assert.equal(first.ok, true);
  r = await startMux();
  assert.equal(r.status, 409);
  process.env.SANDBOX_KILL_SWITCH = "1";
  await L.runner.cancel(first.job.id, U1);
  r = await startMux();
  assert.equal(r.status, 503);
  delete process.env.SANDBOX_KILL_SWITCH;
  await L.db.sandboxUsageMonth.create({ data: { month: L.usage.monthKey(), creations: 4800 } });
  r = await startMux();
  assert.equal(r.status, 503); assert.match(r.error, /busy right now/);
  // The hold: a job holds its price, so the balance cannot be spent twice.
  await reset({ credits: 7 });
  muxAnswers({ delayMs: 60_000 });
  assert.equal((await startMux()).ok, true);
  const tr = await import("../../src/lib/reservations");
  const blocked = await tr.createGenerationHeld(U1, 3, { userId: U1, prompt: "x", imageUrl: "", status: "pending" });
  assert.ok("have" in blocked, "the render is refused because 5 of the 7 credits are held");
});

test("the global cap keeps extra jobs queued until a cloud computer is free", { skip }, async () => {
  await reset();
  await L.credits.grantCredits(U2, 50, { reason: "PURCHASE", provider: "t", externalId: "p_u2" });
  process.env.SANDBOX_MAX_CONCURRENT = "1";
  muxAnswers({ delayMs: 60_000 });
  const a = await startMux(U2);
  await L.runner.drive(a.job.id, 3000, 10); // running, waiting on its slow command
  const b = await startMux(U1);
  const jb = await L.runner.advance(b.job.id);
  assert.equal(jb.status, "queued");
  assert.match(jb.message, /free cloud computer/);
  await L.runner.cancel(a.job.id, U2);
  await L.db.sandboxJob.update({ where: { id: b.job.id }, data: { state: {} } });
  const after = await L.runner.advance(b.job.id);
  assert.equal(after.status, "running");
});

test("a quota refusal keeps the job queued with a clear message; it starts once creation works again", { skip }, async () => {
  await reset();
  muxAnswers();
  fake.failCreate = new (await import("../../src/lib/sandbox/provider")).SandboxError("quota", true, "402 usage limit reached");
  const q = await startMux();
  const j = await L.runner.advance(q.job.id);
  assert.equal(j.status, "queued");
  assert.match(j.message, /busy right now/);
  fake.failCreate = null;
  await L.db.sandboxJob.update({ where: { id: q.job.id }, data: { state: {} } }); // the retry time has come
  const done = await L.runner.drive(q.job.id, 10_000, 10);
  assert.equal(done.status, "succeeded");
});

test("a sandbox that vanishes mid-job fails it without charge; a passed deadline kills the command and stops the sandbox", { skip }, async () => {
  await reset();
  muxAnswers({ delayMs: 60_000 });
  let q = await startMux();
  let j = await L.runner.drive(q.job.id, 3000, 10);
  assert.equal(j.step, "stage:0:poll");
  fake.vanish(j.sandboxName);
  j = await L.runner.drive(q.job.id, 5000, 10);
  assert.equal(j.status, "failed"); assert.equal(j.creditsCharged, 0); assert.match(j.error.message, /stopped before/);
  await reset();
  muxAnswers({ delayMs: 60_000 });
  q = await startMux();
  j = await L.runner.drive(q.job.id, 3000, 10);
  await L.db.sandboxJob.update({ where: { id: q.job.id }, data: { deadlineAt: new Date(Date.now() - 1000) } });
  j = await L.runner.drive(q.job.id, 5000, 10);
  assert.equal(j.status, "expired");
  assert.ok(fake.calls.some((c: { op: string }) => c.op === "kill"));
  assert.ok(fake.calls.some((c: { op: string }) => c.op === "stop"));
  assert.equal(await balance(), 100);
});

test("cancel kills, stops and releases the hold; two advance calls at once never run the same step", { skip }, async () => {
  await reset();
  muxAnswers({ delayMs: 60_000 });
  const q = await startMux();
  await Promise.all([L.runner.advance(q.job.id), L.runner.advance(q.job.id), L.runner.advance(q.job.id)]);
  assert.equal(fake.calls.filter((c: { op: string }) => c.op === "create").length, 1);
  for (let i = 0; i < 50; i++) { const j = await L.runner.advance(q.job.id); if (j.step === "stage:0:poll") break; } // started, now waiting on its slow command
  await Promise.all([L.runner.advance(q.job.id), L.runner.advance(q.job.id)]);
  assert.equal(fake.calls.filter((c: { op: string }) => c.op === "start").length, 1);
  const c = await L.runner.cancel(q.job.id, U1);
  assert.equal(c.status, "canceled");
  assert.equal(c.creditsCharged, 0);
  assert.ok(fake.calls.some((x: { op: string }) => x.op === "kill"));
  assert.ok(fake.calls.some((x: { op: string }) => x.op === "stop"));
  assert.equal(await L.runner.cancel(q.job.id, U2), null); // someone else cannot touch it
});

test("no secret ever reaches a sandbox: no secret-named variable, no secret value in any argument", { skip }, async () => {
  await reset();
  process.env.DATABASE_URL_COPY = process.env.DATABASE_URL;
  muxAnswers();
  const q = await startMux();
  await L.runner.drive(q.job.id, 10_000, 10);
  const secretValues = [process.env.R2_SECRET_ACCESS_KEY, process.env.DATABASE_URL, process.env.CLERK_SECRET_KEY, process.env.ANTHROPIC_API_KEY].filter(Boolean) as string[];
  const NAMES = /DATABASE|R2_|SECRET|TOKEN|KEY|CLERK|VERCEL|ANTHROPIC|OIDC/i;
  for (const c of fake.calls) {
    const env = (c.env ?? c.spec?.env ?? {}) as Record<string, string>;
    for (const k of Object.keys(env)) assert.ok(!NAMES.test(k), `env ${k}`);
    const text = JSON.stringify(c);
    for (const v of secretValues) assert.ok(!text.includes(v), `a secret value was sent in ${c.op}`);
  }
});

test("usage: creations, active CPU and memory time are added up per month and the 80 percent alert fires once", { skip }, async () => {
  await reset();
  muxAnswers();
  const q = await startMux();
  await L.runner.drive(q.job.id, 10_000, 10);
  const u = await L.usage.usageNow();
  assert.equal(u.used.creations, 1);
  assert.equal(u.used.activeCpuMs, 1500);
  assert.ok(u.used.gbHours >= (2 * 2 * 60_000) / 3_600_000 - 1e-9); // one-minute minimum, 2 GB per vCPU
  await L.usage.recordUsage({ creations: 3999 }); // 4,000 of 5,000 = 80 percent
  assert.equal((await L.db.sandboxUsageMonth.findUnique({ where: { month: u.month } })).alertedAt !== null, true);
});

async function sandboxTool(user: string, network = "none") {
  const t = await L.db.coreTool.create({ data: { userId: user, name: "Renamer", description: "x", kind: "sandbox", runtime: "node", entry: "main.js", files: [{ path: "main.js", key: `u/${user}/tools/t1/v1/main.js`, bytes: 10 }], inputSchema: { fields: [{ name: "prefix", label: "Prefix", type: "text", required: true }, { name: "files", label: "Files", type: "file", multiple: true, accept: [".wav"] }] }, network } });
  put(`u/${user}/tools/t1/v1/main.js`, Buffer.from("console.log('hi')"));
  return t;
}

test("core.tool.run: inputs fetched, network closed before the tool starts, outputs listed and uploaded, links in the result", { skip }, async () => {
  await reset();
  const tool = await sandboxTool(U1);
  put(`u/${U1}/tools/in/abc-a.wav`, Buffer.from("WAV"));
  fake.on("bash fetch.sh", () => ({ exitCode: 0 }));
  fake.on("timeout", ({ box }: { box: { files: Map<string, Buffer> } }) => { box.files.set("out/a.mp3", Buffer.from("MP3")); return { exitCode: 0, stdout: "converted 1 file" }; });
  fake.on("node list.mjs", ({ box }: { box: { files: Map<string, Buffer> } }) => { box.files.set("out-manifest.json", Buffer.from(JSON.stringify({ ok: true, files: [{ name: "a.mp3", bytes: 3 }] }))); return { exitCode: 0 }; });
  fake.on("bash upload.sh", async ({ args }: { args: string[] }) => { await fetch(args[2], { method: "PUT", body: "MP3" }); return { exitCode: 0 }; });
  const id = "sbxtooltest1";
  const input = await L.tools.toolRunInput(U1, tool, id, { values: { prefix: "x" }, files: { files: [{ key: `u/${U1}/tools/in/abc-a.wav`, name: "a.wav" }] } });
  assert.deepEqual(input.params.files, ["in/1-a.wav"]);
  const q = await L.runner.enqueue("core.tool.run", U1, input, { id });
  const job = await L.runner.drive(q.job.id, 10_000, 10);
  assert.equal(job.status, "succeeded", JSON.stringify(job.error));
  const order = fake.calls.filter((c: { op: string }) => c.op === "network" || c.op === "start" || c.op === "run").map((c: { op: string; network?: { kind: string }; cmd?: string; args?: string[] }) => (c.op === "network" ? `net:${c.network!.kind}` : `${c.op}:${c.cmd} ${c.args?.[0] ?? ""}`));
  // The tool starts only after the network was closed; storage opens again only after leftovers were stopped.
  assert.deepEqual(order, ["net:allowlist", "start:bash fetch.sh", "net:none", "start:timeout -k", "net:none", "start:node list.mjs", "net:allowlist", "run:sh -c", "start:bash upload.sh"].map((x) => x.replace(/ $/, "")).map(String));
  const v = await L.view.jobView(job);
  assert.equal(v.output.files[0].name, "a.mp3");
  assert.match(v.output.files[0].url, /tools\/runs/);
  assert.match(v.output.log, /converted/);
  assert.equal(job.creditsCharged, 5);
});

test("core.tool.run: foreign files and unapproved internet are refused; a form value outside its limits is refused", { skip }, async () => {
  await reset();
  const tool = await sandboxTool(U1, "internet");
  await assert.rejects(L.tools.toolRunInput(U1, tool, "x", { values: { prefix: "x" } }), /Approve this tool's internet/);
  await L.db.coreTool.update({ where: { id: tool.id }, data: { approvedNet: 1 } });
  const t2 = await L.db.coreTool.findUnique({ where: { id: tool.id } });
  await assert.rejects(L.tools.toolRunInput(U1, t2, "x", { values: { prefix: "x" }, files: { files: [{ key: `u/${U2}/tools/in/zz-a.wav`, name: "a.wav" }] } }), /not yours/);
  await assert.rejects(L.tools.toolRunInput(U1, t2, "x", { values: {} }), /Prefix is needed/);
  put(`u/${U1}/tools/in/q-b.txt`, Buffer.from("x"));
  await assert.rejects(L.tools.toolRunInput(U1, t2, "x", { values: { prefix: "p" }, files: { files: [{ key: `u/${U1}/tools/in/q-b.txt`, name: "b.txt" }] } }), /accepts \.wav/);
  const ok = await L.tools.toolRunInput(U1, t2, "x", { values: { prefix: "p" } });
  assert.equal(ok.network, "internet");
  assert.equal(await L.tools.ownTool(U2, tool.id), null);
  // A new version loses the approval.
  await L.db.coreTool.update({ where: { id: tool.id }, data: { version: 2 } });
  await assert.rejects(L.tools.toolRunInput(U1, await L.db.coreTool.findUnique({ where: { id: tool.id } }), "x", { values: { prefix: "p" } }), /Approve/);
});

test("core.exec: the first tool call opens a session; commands come back labelled as data; save_tool stores the files; stop charges per 5 minutes", { skip }, async () => {
  await reset();
  fake.on("bash", ({ args }: { args: string[] }) => ({ exitCode: 0, stdout: `ran: ${args[1]}` }));
  fake.on("find", () => ({ exitCode: 0, stdout: "main.js\t20\n" }));
  let r = await L.session.runSessionTool("sandbox_exec", { command: "echo hi" }, U1, "chat1");
  assert.match(r.text, /<sandbox_output>/);
  assert.match(r.text, /ran: echo hi/);
  const job = await L.db.sandboxJob.findFirst({ where: { userId: U1, kind: "core.exec" } });
  assert.equal(job.step, "session");
  assert.equal(job.sandboxName, `core_${job.id}`);
  assert.equal(fake.calls.find((c: { op: string }) => c.op === "create").spec.network.kind, "none");
  r = await L.session.runSessionTool("sandbox_write_file", { path: "../etc/passwd", content: "x" }, U1, "chat1");
  assert.equal(r.isError, true);
  r = await L.session.runSessionTool("sandbox_write_file", { path: "main.js", content: "console.log(1)" }, U1, "chat1");
  assert.match(r.text, /Wrote/);
  r = await L.session.runSessionTool("sandbox_packages", { on: true }, U1, "chat1");
  assert.deepEqual(fake.calls.filter((c: { op: string }) => c.op === "network").pop().network, { kind: "allowlist", domains: ["registry.npmjs.org", "pypi.org", "files.pythonhosted.org"] });
  r = await L.session.runSessionTool("save_tool", { name: "Hello", description: "Says hi", kind: "sandbox", runtime: "node", entry: "main.js", files: ["main.js"], input_schema: { fields: [] } }, U1, "chat1");
  assert.match(r.text, /Saved the tool "Hello"/);
  const t = await L.db.coreTool.findFirst({ where: { userId: U1 } });
  assert.equal(got(t.files[0].key)?.toString(), "console.log(1)");
  r = await L.session.runSessionTool("save_tool", { name: "Calc", description: "Adds", kind: "browser", html: "<script>1</script>", input_schema: { fields: [] } }, U2, null);
  assert.match(r.text, /Saved the browser tool/); // a browser tool needs no build machine
  r = await L.session.runSessionTool("sandbox_stop", {}, U1, "chat1");
  assert.match(r.text, /closed after/);
  const ended = await L.db.sandboxJob.findUnique({ where: { id: job.id } });
  assert.equal(ended.status, "succeeded");
  assert.equal(ended.creditsCharged, 10); // one started 5-minute block
  assert.ok(fake.calls.some((c: { op: string }) => c.op === "stop"));
  const audit = await L.db.sandboxAudit.findMany({ where: { jobId: job.id } });
  assert.ok(audit.some((a: { tool: string; command: string | null }) => a.tool === "sandbox_exec" && a.command === "echo hi"));
});

test("build.base then smoke: the report and the new snapshot are recorded; smoke retires the previous snapshot", { skip }, async () => {
  await reset();
  fake.on("node probe.mjs", ({ box }: { box: { files: Map<string, Buffer> } }) => { box.files.set("probe.json", Buffer.from(JSON.stringify({ os: "ID=ubuntu", ffmpeg: null }))); return { exitCode: 0 }; });
  fake.on("bash install.sh", () => ({ exitCode: 0, stdout: "== ffmpeg=apt" }));
  fake.on("node verify.mjs", ({ box }: { box: { files: Map<string, Buffer> } }) => { box.files.set("base.json", Buffer.from(JSON.stringify({ ffmpeg: "ffmpeg version 6", chromePath: "/opt/eclipse/browsers/chrome", routes: ["ffmpeg=apt", "browser=playwright"] }))); return { exitCode: 0 }; });
  fake.on("cp", () => ({ exitCode: 0 }));
  const q = await L.runner.enqueue("build.base", ADMIN, {}, { admin: true });
  const job = await L.runner.drive(q.job.id, 10_000, 10);
  assert.equal(job.status, "succeeded", JSON.stringify(job.error));
  assert.equal(fake.calls.find((c: { op: string }) => c.op === "create").spec.base.snapshotId, undefined); // the plain image
  assert.equal(fake.calls.find((c: { op: string; args?: string[] }) => c.op === "start" && c.args?.[0] === "install.sh").sudo, true);
  const snap = await L.sb.getSetting(L.sb.SETTING.snapshot);
  assert.match(snap, /^snap_fake_/);
  assert.equal(await L.sb.getSetting(L.sb.SETTING.previousSnapshot), "snap_base_1");
  assert.equal(await L.sb.chromePath(), "/opt/eclipse/browsers/chrome");
  assert.equal(await L.runner.enqueue("build.base", U1, {}).then((r: { status: number }) => r.status), 403); // owners only
  fake.on("node smoke.mjs", ({ box, args }: { box: { files: Map<string, Buffer> }; args: string[] }) => { assert.equal(args[1], "/opt/eclipse/browsers/chrome"); box.files.set("smoke.json", Buffer.from(JSON.stringify({ ok: true, checks: { node: { ok: true } } }))); return { exitCode: 0 }; });
  const s = await L.runner.enqueue("smoke", ADMIN, { chrome: "/opt/eclipse/browsers/chrome" }, { admin: true });
  const sj = await L.runner.drive(s.job.id, 10_000, 10);
  assert.equal(sj.status, "succeeded", JSON.stringify(sj.error));
  assert.equal(fake.calls.filter((c: { op: string }) => c.op === "create").pop().spec.network.kind, "none");
  assert.equal(await L.sb.getSetting(L.sb.SETTING.smokePassed), snap);
  assert.equal(await L.sb.getSetting(L.sb.SETTING.previousSnapshot), null);
});

test("a failed smoke keeps its check list and leaves the snapshots alone", { skip }, async () => {
  await reset();
  await L.sb.setSetting(L.sb.SETTING.previousSnapshot, "snap_old");
  fake.on("node smoke.mjs", ({ box }: { box: { files: Map<string, Buffer> } }) => { box.files.set("smoke.json", Buffer.from(JSON.stringify({ ok: false, checks: { ffmpeg: { ok: false, out: "not found" } } }))); return { exitCode: 0 }; });
  const s = await L.runner.enqueue("smoke", ADMIN, { chrome: "" }, { admin: true });
  const sj = await L.runner.drive(s.job.id, 10_000, 10);
  assert.equal(sj.status, "failed");
  assert.equal((await L.view.jobView(sj, true)).output.checks.ffmpeg.out, "not found");
  assert.equal(await L.sb.getSetting(L.sb.SETTING.previousSnapshot), "snap_old");
});

test("chat credits: a message needs free credits first; a reply is charged what it used, never below zero", { skip }, async () => {
  await reset({ credits: 4 });
  const cc = await import("../../src/lib/chat-credits");
  assert.match(String(await cc.chatCreditCheck(U1)), /out of credits/); // 4 free, 5 needed to start
  await L.credits.grantCredits(U1, 10, { reason: "GRANT" });
  assert.equal(await cc.chatCreditCheck(U1), null);
  const m = new cc.ChatMeter();
  m.add("claude-sonnet-5-5", { input_tokens: 10_000, output_tokens: 1_000 });
  assert.equal(await cc.chargeChat(U1, m, "Core message"), 5);
  assert.equal(await balance(), 9);
  const big = new cc.ChatMeter();
  big.add("claude-opus-5-5", { output_tokens: 100_000 }); // 2 dollars = 313 credits
  assert.equal(await cc.chargeChat(U1, big, "Atlas message"), 9); // only what is left
  assert.equal(await balance(), 0);
  process.env.CREDITS_ENABLED = "0";
  assert.equal(await cc.chatCreditCheck(U1), null); // charging off: free
  process.env.CREDITS_ENABLED = "1";
});
