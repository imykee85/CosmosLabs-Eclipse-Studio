// The Node script a sandbox (or a local test) runs to turn a scene into a guide video: headless Chromium draws each frame with the bundled page code
// (render-bundle.generated.ts), ffmpeg encodes them. No clock, so the same scene gives the same video. Usage: node render.mjs scene.json out.mp4 <480|720>
import { ASPECTS, type AspectId } from "./schema";

/** Output size for a frame shape: `res` is the short side in pixels, both sides even. */
export function guideSize(aspect: AspectId, res: 480 | 720): { w: number; h: number } {
  const a = ASPECTS[aspect], even = (n: number) => Math.max(2, Math.round(n / 2) * 2);
  return a >= 1 ? { w: even(res * a), h: res } : { w: res, h: even(res / a) };
}

export const RENDER_MJS = String.raw`import { chromium } from "playwright";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
const [sceneFile, outFile, resArg] = process.argv.slice(2);
const scene = JSON.parse(readFileSync(sceneFile, "utf8")), bundle = readFileSync("bundle.js", "utf8"), res = Number(resArg) === 480 ? 480 : 720;
const ASPECTS = { "16:9": 16 / 9, "9:16": 9 / 16, "1:1": 1, "4:5": 4 / 5, "2.39:1": 2.39 };
const sh = scene.shots[0], a = ASPECTS[sh.aspect] ?? 16 / 9, even = (n) => Math.max(2, Math.round(n / 2) * 2);
const w = a >= 1 ? even(res * a) : res, h = a >= 1 ? res : even(res / a);
const frames = Math.round((sh.endS - sh.startS) * scene.fps);
const chrome = process.env.SHOT_CHROME || readFileSync("/opt/eclipse/chrome_path", "utf8").trim();
mkdirSync("frames", { recursive: true });
const browser = await chromium.launch({ executablePath: chrome, args: ["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const page = await browser.newPage(); await page.setContent("<body style='margin:0'></body>"); await page.addScriptTag({ content: bundle });
await page.evaluate(([s, w, h]) => { globalThis.__r = globalThis.ShotRender.build(s, w, h); }, [scene, w, h]);
for (let f = 0; f < frames; f++) {
  const url = await page.evaluate((f) => globalThis.__r.frame(0, f), f);
  writeFileSync("frames/" + String(f).padStart(5, "0") + ".jpg", Buffer.from(url.split(",")[1], "base64"));
}
await browser.close();
const r = spawnSync("ffmpeg", ["-y", "-v", "error", "-framerate", String(scene.fps), "-i", "frames/%05d.jpg", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18", "-movflags", "+faststart", outFile]);
if (r.status !== 0 || !existsSync(outFile)) { console.error(String(r.stderr).slice(0, 1500)); process.exit(1); }
`;
