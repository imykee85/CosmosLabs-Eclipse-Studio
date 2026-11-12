// node still.mjs 16x9|9x16 frame,frame,... -> out/still-<shape>-<frame>.jpg
import { createRequire } from "node:module"; import fs from "node:fs"; import path from "node:path"; import http from "node:http";
const require = createRequire("/home/user/CosmosLabs-Eclipse-Studio/package.json"); const { chromium } = require("playwright-core");
const HERE = path.dirname(new URL(import.meta.url).pathname), shape = process.argv[2] || "16x9", frames = (process.argv[3] || "0").split(",").map(Number);
const [w, h] = shape === "9x16" ? [1080, 1920] : [1920, 1080];
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".woff2": "font/woff2" };
const srv = http.createServer((q, s) => { const p = path.join(HERE, decodeURIComponent(q.url.split("?")[0])); if (!p.startsWith(HERE) || !fs.existsSync(p)) { s.writeHead(404); return s.end(); } s.writeHead(200, { "content-type": TYPES[path.extname(p)] || "application/octet-stream" }); fs.createReadStream(p).pipe(s); });
await new Promise((ok) => srv.listen(0, ok)); const port = srv.address().port;
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1243/chrome-linux64/chrome", args: ["--no-proxy-server", "--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 800, height: 600 } }); page.on("pageerror", (e) => console.log("PAGE ERROR", e.message));
await page.goto(`http://localhost:${port}/film.html?w=${w}&h=${h}&safe=0`); await page.evaluate(() => window.boot);
for (const f of frames) { const b = await page.evaluate((n) => window.renderFrame(n), f); fs.writeFileSync(path.join(HERE, "out", `still-${shape}-${f}.jpg`), Buffer.from(b, "base64")); }
await browser.close(); srv.close(); console.log("done", frames.join(","));
