import test from "node:test";
import assert from "node:assert/strict";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { SAMPLE_HINT, forSample, mapElevenLabsError, mapFishError } from "../../src/lib/audio/errors";
import { elevenlabs } from "../../src/lib/audio/providers/elevenlabs";
import { fish } from "../../src/lib/audio/providers/fish";
import { minimax } from "../../src/lib/audio/providers/minimax";
import { CLONE_PROVIDERS, DESIGN_PROVIDERS, signToken, sniffAudio } from "../../src/lib/audio/voices";
import { ProviderFailure } from "../../src/lib/audio/types";

const sample = { name: "My voice", sample: new Uint8Array(Buffer.from("ID3-sample-bytes")), mime: "audio/mpeg", fileName: "sample.mp3" };

test("sniffAudio reads the type from the bytes, not the name", () => {
  assert.equal(sniffAudio(Buffer.from("ID3\x04abc"))?.ext, "mp3");
  assert.equal(sniffAudio(new Uint8Array([0xff, 0xfb, 0x90, 0x00]))?.ext, "mp3");
  assert.equal(sniffAudio(Buffer.from("RIFF\x00\x00\x00\x00WAVEfmt "))?.ext, "wav");
  assert.equal(sniffAudio(Buffer.from("\x00\x00\x00\x20ftypM4A "))?.ext, "m4a");
  assert.equal(sniffAudio(Buffer.from("OggS\x00"))?.ogg, true);
  assert.equal(sniffAudio(Buffer.from("MZ\x90\x00 an exe")), null);
  assert.equal(sniffAudio(Buffer.from("")), null);
});

test("design tokens are tied to the person they were made for", () => {
  const a = signToken("user_a", "elevenlabs", "tok123");
  assert.equal(a, signToken("user_a", "elevenlabs", "tok123"));
  assert.notEqual(a, signToken("user_b", "elevenlabs", "tok123"));
  assert.notEqual(a, signToken("user_a", "minimax", "tok123"));
  assert.notEqual(a, signToken("user_a", "elevenlabs", "tok124"));
});

test("a rejected sample says what a good sample is; busy and owner alerts keep their own messages", () => {
  assert.equal(forSample(mapElevenLabsError)(422, "").userMessage, SAMPLE_HINT);
  assert.equal(forSample(mapFishError)(400, "").userMessage, SAMPLE_HINT);
  assert.notEqual(forSample(mapFishError)(429, "").userMessage, SAMPLE_HINT);
  assert.equal(forSample(mapFishError)(402, "").alert, true);
});

test("who can clone and who can design", () => {
  assert.deepEqual(CLONE_PROVIDERS, ["elevenlabs", "fish", "minimax"]);
  assert.deepEqual(DESIGN_PROVIDERS, ["elevenlabs", "fish", "minimax"]);
  assert.ok(fish.cloneVoice && fish.designVoice && elevenlabs.designVoice && minimax.designVoice);
});

async function fakeServer(handler: (r: IncomingMessage, body: string, res: ServerResponse) => void) {
  const srv = createServer((r, res) => { let b = ""; r.on("data", (c) => (b += c)); r.on("end", () => handler(r, b, res)); });
  await new Promise<void>((ok) => srv.listen(0, "127.0.0.1", ok));
  return { base: `http://127.0.0.1:${(srv.address() as AddressInfo).port}`, close: () => srv.close() };
}

test("ElevenLabs: clone sends a multipart sample, design returns previews, save and delete hit the right paths", async () => {
  const seen: { method?: string; url?: string; type?: string; body: string }[] = [];
  const s = await fakeServer((r, body, res) => {
    seen.push({ method: r.method, url: r.url, type: r.headers["content-type"], body });
    const json = (o: unknown, code = 200) => { res.writeHead(code, { "content-type": "application/json" }); res.end(JSON.stringify(o)); };
    if (r.url === "/v1/voices/add") return json(body.includes("verifyme") ? { voice_id: "v_ver", requires_verification: true } : { voice_id: "v_clone", requires_verification: false });
    if (r.url === "/v1/text-to-voice/design") return json({ previews: [{ generated_voice_id: "gen1", audio_base_64: Buffer.from("ID3a").toString("base64"), media_type: "audio/mpeg", duration_secs: 6.5 }, { generated_voice_id: "gen2", audio_base_64: "" }] });
    if (r.url === "/v1/text-to-voice") return json({ voice_id: "v_designed" });
    if (r.method === "DELETE") return json({ status: "ok" });
    json({}, 404);
  });
  try {
    const ctx = { apiKey: "k", baseUrl: s.base };
    assert.equal((await elevenlabs.cloneVoice!(sample, ctx)).voiceId, "v_clone");
    assert.match(seen[0].type ?? "", /^multipart\/form-data/);
    assert.match(seen[0].body, /name="name"[\s\S]*My voice/);
    assert.match(seen[0].body, /name="files"; filename="sample.mp3"/);
    // a voice that needs verification is removed again and refused
    await assert.rejects(elevenlabs.cloneVoice!({ ...sample, name: "verifyme" }, ctx), (e: unknown) => e instanceof ProviderFailure && e.error.code === "needs_verification");
    assert.ok(seen.some((x) => x.method === "DELETE" && x.url === "/v1/voices/v_ver"));
    const prev = await elevenlabs.designVoice!({ description: "A warm calm narrator in her forties" }, ctx);
    assert.deepEqual(prev.map((p) => [p.token, p.durationMs]), [["gen1", 6500]]);
    assert.equal((await elevenlabs.saveDesign!("gen1", { name: "Warm", description: "A warm calm narrator in her forties" }, ctx)).voiceId, "v_designed");
    assert.deepEqual(JSON.parse(seen.find((x) => x.url === "/v1/text-to-voice")!.body), { voice_name: "Warm", voice_description: "A warm calm narrator in her forties", generated_voice_id: "gen1" });
    await elevenlabs.deleteVoice!("v_clone", "cloned", ctx);
  } finally { s.close(); }
});

test("Fish: clone posts a private fast-trained voice, a failed training is refused, delete uses the id", async () => {
  const seen: { method?: string; url?: string; body: string }[] = [];
  const s = await fakeServer((r, body, res) => {
    seen.push({ method: r.method, url: r.url, body });
    res.writeHead(r.method === "POST" ? 201 : 200, { "content-type": "application/json" });
    res.end(JSON.stringify(body.includes("badtrain") ? { _id: "m_bad", state: "failed" } : { _id: "m_ok", state: "trained" }));
  });
  try {
    const ctx = { apiKey: "k", baseUrl: s.base };
    assert.equal((await fish.cloneVoice!(sample, ctx)).voiceId, "m_ok");
    for (const f of ['name="type"', "tts", 'name="train_mode"', "fast", 'name="visibility"', "private", 'name="voices"; filename="sample.mp3"']) assert.ok(seen[0].body.includes(f), f);
    await assert.rejects(fish.cloneVoice!({ ...sample, name: "badtrain" }, ctx), (e: unknown) => e instanceof ProviderFailure && e.error.code === "clone_failed");
    assert.ok(seen.some((x) => x.method === "DELETE" && x.url === "/model/m_bad"));
    await fish.deleteVoice!("m_ok", "cloned", ctx);
    assert.ok(seen.some((x) => x.method === "DELETE" && x.url === "/model/m_ok"));
  } finally { s.close(); }
});

test("MiniMax: clone keeps a 19-digit file id exact, design returns a usable voice, errors inside HTTP 200 are read", async () => {
  const seen: { url?: string; body: string }[] = [];
  const s = await fakeServer((r, body, res) => {
    seen.push({ url: r.url, body });
    res.writeHead(200, { "content-type": "application/json" });
    if (r.url === "/v1/files/upload") return res.end('{"file":{"file_id":1234567890123456789,"bytes":16},"base_resp":{"status_code":0,"status_msg":"success"}}');
    if (r.url === "/v1/voice_clone") return res.end(body.includes("1234567890123456789") ? '{"input_sensitive":false,"base_resp":{"status_code":0}}' : '{"base_resp":{"status_code":2013}}');
    if (r.url === "/v1/voice_design") return res.end(JSON.stringify({ voice_id: "design_voice_1", trial_audio: Buffer.from("ID3t").toString("hex"), base_resp: { status_code: 0 } }));
    if (r.url === "/v1/delete_voice") return res.end(JSON.stringify({ base_resp: { status_code: JSON.parse(body).voice_id === "gone" ? 2042 : 0 } }));
    res.end("{}");
  });
  try {
    const ctx = { apiKey: "k", baseUrl: s.base };
    const c = await minimax.cloneVoice!(sample, ctx);
    assert.match(c.voiceId, /^e[0-9a-f]{32}$/);
    const cloneBody = JSON.parse(seen.find((x) => x.url === "/v1/voice_clone")!.body.replace("1234567890123456789", '"1234567890123456789"'));
    assert.equal(cloneBody.file_id, "1234567890123456789");
    assert.equal(cloneBody.voice_id, c.voiceId);
    const d = await minimax.designVoice!({ description: "A friendly young man, fast pace" }, ctx);
    assert.equal(d[0].token, "design_voice_1");
    assert.equal(Buffer.from(d[0].audio).toString(), "ID3t");
    assert.equal((await minimax.saveDesign!("design_voice_1", { name: "x", description: "y" }, ctx)).voiceId, "design_voice_1");
    await minimax.deleteVoice!(c.voiceId, "cloned", ctx);
    assert.equal(JSON.parse(seen.filter((x) => x.url === "/v1/delete_voice")[0].body).voice_type, "voice_cloning");
    await minimax.deleteVoice!("gone", "designed", ctx); // already removed by MiniMax: nothing to delete, no error
  } finally { s.close(); }
});
