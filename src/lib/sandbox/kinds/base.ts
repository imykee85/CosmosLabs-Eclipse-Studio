import { z } from "zod";
import { SETTING, getSetting, sandboxProvider, setSetting } from "../index";
import type { KindDef } from "./types";

// The owner's two set-up jobs. build.base boots the plain managed image, looks at what it already has, installs what is missing (ffmpeg and fonts;
// a headless browser if it installs cleanly), checks it all, and saves the result as the snapshot every other job boots from. smoke boots that
// snapshot with no network at all and proves the tools work. Nothing about the image is assumed: what was found and which install route worked
// is recorded in the job's output and shown on /admin/sandbox.

const PLAYWRIGHT = "1.63.0"; // pinned (released 2026-09-04)

const PROBE = String.raw`import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
const run = (c, a = []) => { const r = spawnSync(c, a, { encoding: "utf8", timeout: 30000 }); return r.error ? null : ((r.stdout || "") + (r.stderr || "")).trim().split("\n")[0].slice(0, 200); };
const which = (n) => run("sh", ["-c", "command -v " + n]) || null;
let os = ""; try { os = readFileSync("/etc/os-release", "utf8").split("\n").filter((l) => /^(PRETTY_NAME|ID|VERSION_ID)=/.test(l)).join("; "); } catch {}
const r = { os, user: run("id", ["-un"]), node: run("node", ["--version"]), python: run("python3", ["--version"]), ffmpeg: which("ffmpeg") ? run("ffmpeg", ["-version"]) : null,
  apt: which("apt-get"), dnf: which("dnf"), sudo: run("sudo", ["-n", "true"]) === "" ? "yes" : run("sudo", ["-n", "true"]),
  browsers: Object.fromEntries(["chromium", "chromium-browser", "google-chrome", "google-chrome-stable"].map((b) => [b, which(b)])) };
writeFileSync("probe.json", JSON.stringify(r));
console.log(JSON.stringify(r));
`;

// Runs as root (sudo). Each route is tried in order and the first that works is written to /opt/eclipse/routes. A browser that will not install
// is not an error: the base ships without one and the report says so.
const INSTALL = String.raw`#!/bin/bash
set -u
mkdir -p /opt/eclipse && : > /opt/eclipse/routes
note(){ echo "$1" >> /opt/eclipse/routes; echo "== $1"; }
if command -v ffmpeg >/dev/null 2>&1; then note "ffmpeg=already-present"
elif command -v apt-get >/dev/null 2>&1 && (apt-get update -y && DEBIAN_FRONTEND=noninteractive apt-get install -y ffmpeg fonts-noto-core fonts-noto-color-emoji); then note "ffmpeg=apt"
elif command -v dnf >/dev/null 2>&1 && (dnf install -y ffmpeg-free google-noto-sans-fonts google-noto-emoji-color-fonts || dnf install -y ffmpeg); then note "ffmpeg=dnf"
elif (cd /tmp && curl -fsSL https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz -o ff.tar.xz && tar -xf ff.tar.xz && cp ffmpeg-*-static/ffmpeg ffmpeg-*-static/ffprobe /usr/local/bin/); then note "ffmpeg=static-build"
else note "ffmpeg=FAILED"; fi
if command -v apt-get >/dev/null 2>&1; then DEBIAN_FRONTEND=noninteractive apt-get install -y fonts-noto-core fonts-noto-color-emoji >/dev/null 2>&1 && note "fonts=apt"; fi
# Optional browser. (a) Playwright's Chromium into a folder every user can read; (b) Google Chrome's package. A snap "chromium" is never used.
export PLAYWRIGHT_BROWSERS_PATH=/opt/eclipse/browsers
test_browser(){ echo '<h1>ok</h1>' > /tmp/t.html; "$1" --headless=new --no-sandbox --disable-gpu --dump-dom file:///tmp/t.html 2>/dev/null | grep -q '<h1>ok</h1>'; }
found=""
if (npx -y playwright@${PLAYWRIGHT} install --with-deps chromium || npx -y playwright@${PLAYWRIGHT} install chromium); then
  c=$(find /opt/eclipse/browsers -type f -name chrome -path '*chrome-linux*' 2>/dev/null | head -1)
  if [ -n "$c" ] && test_browser "$c"; then found="$c"; note "browser=playwright"; fi
fi
if [ -z "$found" ] && command -v apt-get >/dev/null 2>&1; then
  (cd /tmp && curl -fsSL https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb -o chrome.deb && DEBIAN_FRONTEND=noninteractive apt-get install -y ./chrome.deb) && c=$(command -v google-chrome-stable) && test_browser "$c" && found="$c" && note "browser=chrome-deb"
fi
if [ -z "$found" ] && command -v dnf >/dev/null 2>&1; then
  dnf install -y https://dl.google.com/linux/direct/google-chrome-stable_current_x86_64.rpm && c=$(command -v google-chrome-stable) && test_browser "$c" && found="$c" && note "browser=chrome-rpm"
fi
[ -z "$found" ] && note "browser=none"
echo -n "$found" > /opt/eclipse/chrome_path
chmod -R a+rX /opt/eclipse
command -v ffmpeg >/dev/null 2>&1
`;

const VERIFY = String.raw`import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
const run = (c, a = []) => { const r = spawnSync(c, a, { encoding: "utf8", timeout: 60000 }); return { ok: !r.error && r.status === 0, out: ((r.stdout || "") + (r.stderr || "")).trim().split("\n")[0].slice(0, 200) }; };
const read = (p) => { try { return readFileSync(p, "utf8").trim(); } catch { return ""; } };
const chromePath = read("/opt/eclipse/chrome_path");
const r = { date: new Date().toISOString(), node: run("node", ["--version"]).out, python: run("python3", ["--version"]).out, ffmpeg: run("ffmpeg", ["-version"]).out, ffprobe: run("ffprobe", ["-version"]).out,
  routes: read("/opt/eclipse/routes").split("\n").filter(Boolean), chromePath: chromePath || null, chrome: chromePath ? run(chromePath, ["--version"]).out : null };
writeFileSync("base.json", JSON.stringify(r));
console.log(JSON.stringify(r));
process.exit(r.ffmpeg.startsWith("ffmpeg version") ? 0 : 1);
`;

const SMOKE = String.raw`import { spawnSync } from "node:child_process";
import { existsSync, statSync, writeFileSync } from "node:fs";
const run = (c, a = []) => { const r = spawnSync(c, a, { encoding: "utf8", timeout: 90000 }); return { ok: !r.error && r.status === 0, out: ((r.stdout || "") + (r.stderr || "")).trim().split("\n").slice(-1)[0].slice(0, 200) }; };
const chrome = process.argv[2] || "";
const checks = { node: run("node", ["--version"]), ffmpeg: run("ffmpeg", ["-version"]) };
checks.video = run("ffmpeg", ["-y", "-f", "lavfi", "-i", "testsrc=duration=2:size=320x240:rate=24", "-f", "lavfi", "-i", "sine=frequency=440:duration=2", "-shortest", "-pix_fmt", "yuv420p", "out.mp4"]);
if (checks.video.ok) { const p = run("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", "out.mp4"]); checks.video = { ok: p.ok && Number(p.out) > 1.5, out: "duration " + p.out }; }
if (chrome) {
  checks.browser = run(chrome, ["--version"]);
  writeFileSync("page.html", "<html><body style='font:40px sans-serif'>Eclipse sandbox</body></html>");
  const s = run(chrome, ["--headless=new", "--no-sandbox", "--disable-gpu", "--window-size=640,360", "--screenshot=" + process.cwd() + "/shot.png", "file://" + process.cwd() + "/page.html"]);
  checks.screenshot = { ok: s.ok && existsSync("shot.png") && statSync("shot.png").size > 1000, out: existsSync("shot.png") ? "shot.png " + statSync("shot.png").size + " bytes" : s.out };
}
const ok = Object.values(checks).every((c) => c.ok);
writeFileSync("smoke.json", JSON.stringify({ ok, checks }));
console.log(JSON.stringify({ ok, checks }));
`;

const Empty = z.object({}).strict();
type Empty = z.infer<typeof Empty>;
const parseJson = (b: Buffer | null) => { try { return b ? (JSON.parse(b.toString("utf8")) as Record<string, unknown>) : null; } catch { return null; } };

export const buildBase: KindDef<Empty> = {
  kind: "build.base",
  schema: Empty,
  vcpus: 2,
  deadlineMs: 25 * 60_000,
  network: () => ({ kind: "open" }), // full internet for the package installs: with private ranges blocked the sandbox could not even look up names (seen live 2026-10-17); owner-only job, nothing of ours on the machine
  base: "image",
  price: () => 0,
  stageCount: () => 4,
  stage: async (_ctx, i) => {
    if (i === 0) return { name: "probe", files: [{ path: "probe.mjs", content: Buffer.from(PROBE) }], cmd: "node", args: ["probe.mjs"], allowFail: true };
    if (i === 1) return { name: "install", files: [{ path: "install.sh", content: Buffer.from(INSTALL), mode: 0o755 }], cmd: "bash", args: ["install.sh"], sudo: true };
    if (i === 2) return { name: "verify", files: [{ path: "verify.mjs", content: Buffer.from(VERIFY) }], cmd: "node", args: ["verify.mjs"] };
    return { name: "version", cmd: "cp", args: ["base.json", "/opt/eclipse/VERSION"], sudo: true, network: { kind: "none" } };
  },
  collect: async (ctx) => {
    const base = parseJson(await ctx.provider.readFile(ctx.name, "base.json", 64_000));
    const probe = parseJson(await ctx.provider.readFile(ctx.name, "probe.json", 64_000));
    if (!base) return { output: { probe }, failed: "The base check did not write its report." };
    return { output: { probe, base } };
  },
  snapshotAtEnd: true,
  failMessage: "The base could not be built. The admin page shows the log.",
  onFinished: async (job) => {
    const out = (job.output ?? {}) as { snapshotId?: string; base?: { chromePath?: string | null } };
    if (job.status !== "succeeded" || !out.snapshotId) return;
    const current = await getSetting(SETTING.snapshot);
    // Keep the old snapshot until the new one passes smoke; at most two are kept (15 GB of snapshot storage on Hobby).
    const older = await getSetting(SETTING.previousSnapshot);
    if (older && older !== current) await sandboxProvider()?.deleteSnapshot?.(older).catch((e) => console.error("old snapshot delete failed", older, e));
    await setSetting(SETTING.previousSnapshot, current);
    await setSetting(SETTING.snapshot, out.snapshotId);
    await setSetting(SETTING.chrome, out.base?.chromePath || null);
    await setSetting(SETTING.baseReport, JSON.stringify(job.output));
  },
};

export const smoke: KindDef<{ chrome: string }> = {
  kind: "smoke",
  schema: z.object({ chrome: z.string().max(300) }).strict(),
  vcpus: 2,
  deadlineMs: 5 * 60_000,
  network: () => ({ kind: "none" }),
  base: "snapshot",
  imageFallback: true, // only smoke may boot the plain image when the snapshot is missing (it then reports what is absent)
  price: () => 0,
  stageCount: () => 1,
  stage: async (_ctx, _i, input) => ({ name: "smoke", files: [{ path: "smoke.mjs", content: Buffer.from(SMOKE) }], cmd: "node", args: ["smoke.mjs", input.chrome], allowFail: true }),
  collect: async (ctx) => {
    const r = parseJson(await ctx.provider.readFile(ctx.name, "smoke.json", 64_000)) as { ok?: boolean } | null;
    const snapshotUsed = ((ctx.job.state ?? {}) as { snapshotUsed?: string | null }).snapshotUsed ?? null;
    if (!r) return { output: { snapshotUsed }, failed: "The smoke test did not write its report." };
    return r.ok ? { output: { ...r, snapshotUsed } } : { output: { ...r, snapshotUsed }, failed: "Some smoke checks failed." };
  },
  failMessage: "The smoke test failed. The admin page shows which check.",
  onFinished: async (job) => {
    const out = (job.output ?? {}) as { snapshotUsed?: string | null };
    if (job.status !== "succeeded" || !out.snapshotUsed) return;
    await setSetting(SETTING.smokePassed, out.snapshotUsed);
    const previous = await getSetting(SETTING.previousSnapshot);
    if (previous && previous !== out.snapshotUsed) {
      await sandboxProvider()?.deleteSnapshot?.(previous).catch((e) => console.error("old snapshot delete failed", previous, e));
      await setSetting(SETTING.previousSnapshot, null);
    }
  },
};
