// Phase 0: render the six test blockouts to guide videos with headless Chromium + ffmpeg. Usage: node scripts/shot-test/render.mjs [outDir] [testIndex...]
import { build } from "esbuild";
import { chromium } from "playwright-core";
import { mkdirSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
const require = createRequire(import.meta.url);
const out = path.resolve(process.argv[2] ?? "/tmp/shotmap-tests"); mkdirSync(out, { recursive: true });
const only = process.argv.slice(3).map(Number);
const ffmpeg = require("@ffmpeg-installer/ffmpeg").path;
const chrome = ["/opt/pw-browsers/chromium-1243/chrome-linux64/chrome", "/opt/pw-browsers/chromium/chrome-linux/chrome"].find(existsSync) ?? process.env.PLAYWRIGHT_CHROMIUM;
// the scene data (TypeScript) and the page code are bundled into one browser script
const bundle = await build({ entryPoints: ["src/lib/shot/render-page.ts"], bundle: true, write: false, format: "iife", platform: "browser", target: "es2020" });
const scenesJs = await build({ stdin: { contents: 'export { TESTS } from "./src/lib/shot/scenes";', resolveDir: process.cwd() }, bundle: true, write: false, format: "esm", platform: "node" });
const tmp = path.join(out, "_scenes.mjs"); writeFileSync(tmp, scenesJs.outputFiles[0].text);
const { TESTS } = await import(tmp);
const browser = await chromium.launch({ executablePath: chrome, args: ["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const page = await browser.newPage(); await page.setContent("<body style='margin:0'></body>"); await page.addScriptTag({ content: bundle.outputFiles[0].text });
for (const [i, scene] of TESTS.entries()) {
  if (only.length && !only.includes(i + 1)) continue;
  const sh = scene.shots[0], vertical = sh.aspect === "9:16", w = vertical ? 720 : 1280, h = vertical ? 1280 : 720;
  const frames = Math.round((sh.endS - sh.startS) * scene.fps), dir = path.join(out, scene.id + "-frames"); mkdirSync(dir, { recursive: true });
  const t0 = Date.now();
  await page.evaluate(([s, w, h]) => { document.querySelectorAll("canvas").forEach((c) => c.remove()); globalThis.__r = globalThis.ShotRender.build(s, w, h); }, [scene, w, h]);
  for (let f = 0; f < frames; f++) {
    const url = await page.evaluate((f) => globalThis.__r.frame(0, f), f);
    writeFileSync(path.join(dir, String(f).padStart(5, "0") + ".jpg"), Buffer.from(url.split(",")[1], "base64"));
  }
  const mp4 = path.join(out, scene.id + ".mp4");
  const r = spawnSync(ffmpeg, ["-y", "-v", "error", "-framerate", String(scene.fps), "-i", path.join(dir, "%05d.jpg"), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18", "-movflags", "+faststart", mp4]);
  console.log(scene.id, `${w}x${h}`, `${frames} frames`, `${((Date.now() - t0) / 1000).toFixed(1)} s`, r.status === 0 ? mp4 : "ffmpeg failed: " + r.stderr);
}
await browser.close();
