import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import http from "node:http";
import https from "node:https";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// The whole path with fakes: a provider that serves a 3:2 picture and a 16:9 clip over https, a storage server that keeps what is put into it, and the real
// save functions. With a target ratio the stored files come out in that ratio; without one they are stored as the model made them.
const bin = () => process.env.FFMPEG_PATH || (require("@ffmpeg-installer/ffmpeg") as { path: string }).path;

test("stored pictures and clips take the reference's ratio when a target is given", async () => {
  const dir = mkdtempSync(join(tmpdir(), "eclipse-cs-"));
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
  try {
    const png = join(dir, "p.png"), mp4 = join(dir, "v.mp4");
    execFileSync(bin(), ["-v", "error", "-f", "lavfi", "-i", "testsrc=size=1536x1024:rate=1:duration=1", "-frames:v", "1", png]);
    execFileSync(bin(), ["-v", "error", "-f", "lavfi", "-i", "testsrc=size=640x360:rate=10:duration=2", "-pix_fmt", "yuv420p", mp4]);
    execFileSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", join(dir, "k.pem"), "-out", join(dir, "c.pem"), "-days", "1", "-subj", "/CN=localhost"], { stdio: "ignore" });
    const provider = https.createServer({ key: readFileSync(join(dir, "k.pem")), cert: readFileSync(join(dir, "c.pem")) }, (req, res) => {
      if (req.url === "/p.png") { res.writeHead(200, { "content-type": "image/png" }); res.end(readFileSync(png)); }
      else { res.writeHead(200, { "content-type": "video/mp4" }); res.end(readFileSync(mp4)); }
    });
    const stored = new Map<string, Buffer>();
    const storage = http.createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on("data", (c) => chunks.push(c));
      req.on("end", () => {
        if (req.method === "PUT") { stored.set(req.url!.split("?")[0], Buffer.concat(chunks)); res.writeHead(200, { etag: '"x"' }); res.end(); } else { res.writeHead(200); res.end(); }
      });
    });
    await Promise.all([new Promise<void>((r) => provider.listen(0, r)), new Promise<void>((r) => storage.listen(0, r))]);
    const pPort = (provider.address() as { port: number }).port, sPort = (storage.address() as { port: number }).port;
    Object.assign(process.env, { R2_ACCOUNT_ID: "a", R2_ACCESS_KEY_ID: "k", R2_SECRET_ACCESS_KEY: "s", R2_BUCKET: "b", R2_ENDPOINT: `http://127.0.0.1:${sPort}` });
    const { saveImageFromUrl, saveVideoFromUrl } = await import("../../src/lib/storage");
    const { readImageSize } = await import("../../src/lib/image-info");
    const { probeVideo } = await import("../../src/lib/video-frames");

    // Picture: 3:2 from the model, reference is 4:5.
    const img = await saveImageFromUrl("u1", `https://localhost:${pPort}/p.png`, { w: 800, h: 1000 });
    assert.equal(img.conformed, true);
    assert.ok(img.width && img.height && Math.abs(img.width / img.height - 0.8) < 0.004, `${img.width}x${img.height}`);
    assert.ok(readImageSize(new Uint8Array(stored.get(`/b/${img.key}`)!))!.height === 1024);
    // No target: stored as the model made it.
    const plain = await saveImageFromUrl("u1", `https://localhost:${pPort}/p.png`);
    assert.ok(!plain.conformed);
    assert.equal(plain.width, 1536);

    // Clip: 16:9 from the model, reference is 1:1.
    const vid = await saveVideoFromUrl("u1", "g1", `https://localhost:${pPort}/v.mp4`, { w: 1000, h: 1000 });
    assert.equal(vid.conformed, true);
    const vfile = join(dir, "stored.mp4");
    writeFileSync(vfile, stored.get(`/b/${vid.key}`)!);
    const info = await probeVideo(vfile);
    assert.ok(info && info.width === info.height, `${info?.width}x${info?.height}`);
    const vplain = await saveVideoFromUrl("u1", "g2", `https://localhost:${pPort}/v.mp4`);
    writeFileSync(vfile, stored.get(`/b/${vplain.key}`)!);
    assert.equal((await probeVideo(vfile))!.width, 640);
    provider.close(); storage.close();
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
