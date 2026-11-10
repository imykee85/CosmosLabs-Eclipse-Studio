// Renders the film: steps film.html frame by frame in headless Chromium and pipes the frames to ffmpeg.
// node render.mjs <full|safe> <16x9|9x16> [24|15] [--sheet] [--frames a-b]
import { createRequire } from "node:module"; import fs from "node:fs"; import path from "node:path"; import http from "node:http"; import { spawn } from "node:child_process";
const require = createRequire("/home/user/CosmosLabs-Eclipse-Studio/package.json"); const { chromium } = require("playwright-core");
const HERE = path.dirname(new URL(import.meta.url).pathname);
const [cut = "full", shape = "16x9", len = "24"] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const sheet = process.argv.includes("--sheet"); const fr = (process.argv.find((a) => a.startsWith("--frames=")) || "").slice(9);
const [w, h] = shape === "9x16" ? [1080, 1920] : [1920, 1080];
const TL = JSON.parse(fs.readFileSync(path.join(HERE, "timeline.json"))), T15 = JSON.parse(fs.readFileSync(path.join(HERE, "timeline-15s.json")));
let frames = [...Array(TL.frames).keys()];
if (len === "15") frames = T15.segments.flatMap(([a, b]) => frames.slice(a, b));
if (fr) { const [a, b] = fr.split("-").map(Number); frames = frames.filter((f) => f >= a && f < b); }
if (sheet) frames = frames.filter((_, i) => i % 6 === 0);
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".woff2": "font/woff2" };
const srv = http.createServer((q, s) => { const p = path.join(HERE, decodeURIComponent(q.url.split("?")[0])); if (!p.startsWith(HERE) || !fs.existsSync(p)) { s.writeHead(404); return s.end(); } s.writeHead(200, { "content-type": TYPES[path.extname(p)] || "application/octet-stream" }); fs.createReadStream(p).pipe(s); });
await new Promise((ok) => srv.listen(0, ok)); const port = srv.address().port;
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1243/chrome-linux64/chrome", args: ["--no-proxy-server", "--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 800, height: 600 } }); page.on("pageerror", (e) => console.log("PAGE ERROR", e.message));
await page.goto(`http://localhost:${port}/film.html?w=${w}&h=${h}&safe=${cut === "safe" ? 1 : 0}`); await page.evaluate(() => window.boot);
fs.mkdirSync(path.join(HERE, "out"), { recursive: true });
const name = sheet ? `sheet-${cut}-${shape}` : `launch-${cut}-${shape}${len === "15" ? "-15s" : ""}`;
const audio = path.join(HERE, "out", len === "15" ? "bed-15s.m4a" : "bed-24s.m4a"), hasAudio = !sheet && !fr && fs.existsSync(audio);
const args = sheet
  ? ["-y", "-f", "image2pipe", "-c:v", "mjpeg", "-i", "-", "-vf", `scale=${shape === "9x16" ? 180 : 384}:-1,tile=${shape === "9x16" ? 15 : 8}x${Math.ceil(frames.length / (shape === "9x16" ? 15 : 8))}`, "-frames:v", "1", "-update", "1", "-q:v", "3", path.join(HERE, "out", name + (fr ? "-" + fr : "") + ".jpg")]
  : ["-y", "-f", "image2pipe", "-framerate", "30", "-c:v", "mjpeg", "-i", "-", ...(hasAudio ? ["-i", audio] : []), "-c:v", "libx264", "-preset", "slow", "-crf", "15", "-pix_fmt", "yuv420p", "-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709", ...(hasAudio ? ["-c:a", "copy", "-shortest"] : []), "-movflags", "+faststart", path.join(HERE, "out", name + (fr ? "-" + fr : "") + ".mp4")];
const ff = spawn("ffmpeg", args, { stdio: ["pipe", "ignore", "inherit"] });
const t0 = Date.now();
for (const f of frames) { const b64 = await page.evaluate((n) => window.renderFrame(n), f); if (!ff.stdin.write(Buffer.from(b64, "base64"))) await new Promise((ok) => ff.stdin.once("drain", ok)); }
ff.stdin.end(); await new Promise((ok) => ff.on("close", ok)); await browser.close(); srv.close();
console.log(name, frames.length, "frames in", Math.round((Date.now() - t0) / 1000), "s", hasAudio ? "with sound" : "no sound");
