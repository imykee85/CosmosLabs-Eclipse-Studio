// Storyboard: renders chosen frames at full size and lays them on one sheet. node board.mjs <16x9|9x16> f1,f2,...
import { createRequire } from "node:module"; import fs from "node:fs"; import path from "node:path"; import http from "node:http";
const require = createRequire("/home/user/CosmosLabs-Eclipse-Studio/package.json"); const { chromium } = require("playwright-core"); const sharp = require("sharp");
const HERE = path.dirname(new URL(import.meta.url).pathname), shape = process.argv[2] || "16x9", frames = process.argv[3].split(",").map(Number);
const [w, h] = shape === "9x16" ? [1080, 1920] : [1920, 1080];
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".woff2": "font/woff2" };
const srv = http.createServer((q, s) => { const p = path.join(HERE, decodeURIComponent(q.url.split("?")[0])); if (!p.startsWith(HERE) || !fs.existsSync(p)) { s.writeHead(404); return s.end(); } s.writeHead(200, { "content-type": TYPES[path.extname(p)] || "application/octet-stream" }); fs.createReadStream(p).pipe(s); });
await new Promise((ok) => srv.listen(0, ok));
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1243/chrome-linux64/chrome", args: ["--no-proxy-server", "--no-sandbox"] });
const page = await browser.newPage(); page.on("pageerror", (e) => console.log("PAGE ERROR", e.message));
await page.goto(`http://localhost:${srv.address().port}/film.html?w=${w}&h=${h}`); await page.evaluate(() => window.boot);
const cols = shape === "9x16" ? 6 : 3, tw = shape === "9x16" ? 360 : 960, th = Math.round(tw * h / w), comps = [];
fs.mkdirSync(path.join(HERE, "out/board"), { recursive: true });
for (let i = 0; i < frames.length; i++) { const buf = Buffer.from(await page.evaluate((n) => window.renderFrame(n), frames[i]), "base64"); fs.writeFileSync(path.join(HERE, `out/board/${shape}-${String(i + 1).padStart(2, "0")}-f${frames[i]}.jpg`), buf);
  comps.push({ input: await sharp(buf).resize(tw, th).toBuffer(), left: (i % cols) * tw, top: Math.floor(i / cols) * th }); }
await sharp({ create: { width: cols * tw, height: Math.ceil(frames.length / cols) * th, channels: 3, background: "#000" } }).composite(comps).jpeg({ quality: 88 }).toFile(path.join(HERE, `out/storyboard-${shape}.jpg`));
await browser.close(); srv.close(); console.log("board", frames.length);
