import test from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { buildProject, EDIT_SH, EditRequest } from "../../src/lib/sandbox/kinds/edit";
import { kitFiles } from "../../src/lib/sandbox/kit";

const have = (c: string) => spawnSync(c, ["-version"]).status === 0;
const skip = have("ffmpeg") && spawnSync("python3", ["--version"]).status === 0 ? false : "ffmpeg or python3 missing";

test("the request is checked: ends after starts, limits, unknown keys refused", () => {
  assert.equal(EditRequest.safeParse({ clips: [{ videoId: "a" }] }).success, true);
  assert.equal(EditRequest.safeParse({ clips: [] }).success, false);
  assert.equal(EditRequest.safeParse({ clips: [{ videoId: "a", start: 5, end: 2 }] }).success, false);
  assert.equal(EditRequest.safeParse({ clips: [{ videoId: "a", speed: 9 }] }).success, false);
  assert.equal(EditRequest.safeParse({ clips: [{ videoId: "a" }], platform: "myspace" }).success, false);
  assert.equal(EditRequest.safeParse({ clips: [{ videoId: "a" }], command: "rm -rf /" }).success, false, "no field can carry a command");
  assert.equal(EditRequest.safeParse({ clips: [{ videoId: "a" }], captions: { cues: [{ start: 3, end: 1, text: "x" }] } }).success, false);
});

test("the project file is built from fixed options only, with fixed file names", () => {
  const r = EditRequest.parse({
    clips: [{ videoId: "v1", start: 1, end: 4 }, { videoId: "v2", speed: 2 }], aspect: "9:16", fit: "blur", transition: { type: "fade", seconds: 0.5 }, removeSilence: true,
    captions: { cues: [{ start: 0, end: 2, text: "Hello\nthere" }], animate: "pop" }, title: { text: "Launch", seconds: 3 }, musicTakeId: "m1", cleanVoice: "medium", loudness: -14,
  });
  const { project, cues } = buildProject(r);
  assert.deepEqual(project.clips, [{ src: "clip0.mp4", in: 1, out: 4 }, { src: "clip1.mp4", speed: 2 }]);
  assert.deepEqual(project.frame, { aspect: "9:16", fit: "blur" });
  assert.deepEqual(project.transition, { type: "fade", duration: 0.5 });
  assert.deepEqual(project.audio, { voice: "medium", music: "music.audio", music_volume: -16, duck: true, music_fade_out: 2 });
  assert.deepEqual(project.loudness, { lufs: -14, tp: -1 });
  assert.equal(cues, "0.00-2.00 Hello | there\n");
  assert.equal(JSON.stringify(project).includes("videoId"), false, "ids never reach the project");
  // a platform export replaces the frame; a single clip never gets a transition
  const p2 = buildProject(EditRequest.parse({ clips: [{ videoId: "a" }], aspect: "1:1", platform: "reels", transition: { type: "fade", seconds: 1 } })).project;
  assert.equal(p2.frame, undefined); assert.equal(p2.transition, undefined); assert.deepEqual(p2.export, { preset: "reels", normalize: true });
});

test("the vendored programs are all there, with their licence", () => {
  const files = kitFiles("ffmpeg-skill", "ffskill", (r) => r.startsWith("scripts/") || r.startsWith("templates/"));
  const names = files.map((f) => f.path);
  for (const n of ["ffskill/scripts/render.py", "ffskill/scripts/cut.py", "ffskill/scripts/join.py", "ffskill/scripts/caption.py", "ffskill/scripts/_common/runner.py", "ffskill/templates/reels.json"]) assert.ok(names.includes(n), n);
  assert.ok(files.length > 50);
});

// The REAL edit script and the REAL programs: two generated clips served over HTTP, trimmed, joined with a fade, reframed to 9:16 and captioned, then uploaded to a local server.
test("a real edit: trim + join + 9:16 + captions renders a playable video and uploads it", { skip, timeout: 240_000 }, async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "edit-"));
  const src = path.join(dir, "src"); mkdirSync(src);
  for (const [i, f] of [[0, 440], [1, 660]] as const) {
    const r = spawnSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "testsrc=duration=6:size=640x360:rate=24", "-f", "lavfi", "-i", `sine=frequency=${f}:duration=6`, "-shortest", "-pix_fmt", "yuv420p", path.join(src, `c${i}.mp4`)]);
    assert.equal(r.status, 0, String(r.stderr));
  }
  let uploaded: Buffer | null = null;
  const server = createServer((req, res) => {
    if (req.method === "PUT") { const c: Buffer[] = []; req.on("data", (d) => c.push(d)); req.on("end", () => { uploaded = Buffer.concat(c); res.end(); }); return; }
    const f = path.join(src, path.basename(req.url ?? ""));
    if (existsSync(f)) res.end(readFileSync(f)); else { res.statusCode = 404; res.end(); }
  });
  const port = await new Promise<number>((r) => server.listen(0, "127.0.0.1", () => r((server.address() as { port: number }).port)));
  try {
    const req = EditRequest.parse({ clips: [{ videoId: "a", start: 1, end: 4 }, { videoId: "b", start: 0, end: 3 }], aspect: "9:16", fit: "blur", transition: { type: "fade", seconds: 0.5 }, captions: { cues: [{ start: 0.5, end: 2.5, text: "Hello world" }] } });
    const { project, cues } = buildProject(req);
    const work = path.join(dir, "work"); mkdirSync(work);
    for (const f of kitFiles("ffmpeg-skill", "ffskill", (r) => r.startsWith("scripts/") || r.startsWith("templates/"))) { mkdirSync(path.dirname(path.join(work, f.path)), { recursive: true }); writeFileSync(path.join(work, f.path), f.content); }
    writeFileSync(path.join(work, "edit.sh"), EDIT_SH); writeFileSync(path.join(work, "project.json"), JSON.stringify(project)); writeFileSync(path.join(work, "cues.txt"), cues!);
    // async on purpose: a blocking spawn would freeze the in-process server the script fetches its clips from
    const r = await new Promise<{ status: number | null; stderr: string }>((res) => {
      const p = spawn("bash", ["edit.sh", `http://127.0.0.1:${port}/out`, "-", `http://127.0.0.1:${port}/c0.mp4`, `http://127.0.0.1:${port}/c1.mp4`], { cwd: work });
      let err = ""; p.stderr.on("data", (d) => { err += d; });
      const t = setTimeout(() => p.kill("SIGKILL"), 200_000);
      p.on("close", (status) => { clearTimeout(t); res({ status, stderr: err }); });
    });
    assert.equal(r.status, 0, `edit.sh failed: ${r.stderr.slice(-1500)}`);
    assert.ok(uploaded && (uploaded as Buffer).length > 1000, "the result was uploaded");
    const probe = JSON.parse(readFileSync(path.join(work, "probe.json"), "utf8"));
    const v = probe.streams.find((s: { codec_type: string }) => s.codec_type === "video");
    assert.ok(v.height > v.width, `vertical: ${v.width}x${v.height}`);
    const dur = Number(probe.format.duration);
    assert.ok(dur > 4.5 && dur < 6.2, `3 s + 3 s minus the 0.5 s fade is about 5.5 s, got ${dur}`);
    assert.ok(probe.streams.some((s: { codec_type: string }) => s.codec_type === "audio"), "keeps its sound");
  } finally { server.close(); }
});
