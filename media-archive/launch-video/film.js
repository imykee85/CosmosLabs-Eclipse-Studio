// Eclipse launch film: every frame is drawn by this file on one canvas. No clocks, no randomness that is not seeded:
// the same frame number always gives the same picture. Timing lives in timeline.json (30 fps).
/* global TL, CFG */
const W = CFG.w, H = CFG.h, SAFE = CFG.safe, M = Math.min(W, H), TALL = H > W;
const cv = document.getElementById("c"); cv.width = W; cv.height = H;
const g = cv.getContext("2d");
const acc = document.createElement("canvas"); acc.width = W; acc.height = H; const ag = acc.getContext("2d");
const INK = "#0a0a0a", PAPER = "#F4F1ED", RED = "#c00707", DEEP = "#551E1E", NAVY = "#0d1b3a";
const S = Object.fromEntries(TL.scenes.map((s) => [s.id, s]));
const IM = {};
const NAMES = ["astronaut-reach", "astronaut-standing", "astronaut-tumble", "brain-hands", "camera-tripod", "cells-glow", "cells-grainy", "desert-astronaut-a", "desert-astronaut-b", "finale-plate", "hero-eclipse-seedream", "logo", "moon-disc", "orbit-sunrise", "paraglider", "planet-reveal", "race-car", "rocket-fictional", "rocket-shuttle", "rocket-steel", "runner", "tile-wall", "walker-director", "walker-early-human", "walker-painter", "walker-photographer",
  "cap-memory", "cap-atlas-1-open", "cap-atlas-2-working", "cap-atlas-3-answer", "cap-canvas-1-flow", "cap-audio-1", "cap-shotmap-stage"];
const OUTS = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => `out-${i}`);

// ---------- helpers ----------
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
const prog = (f, a, b) => clamp((f - a) / (b - a));
const eOut = (t) => 1 - Math.pow(1 - t, 3), eIn = (t) => t * t * t, eIO = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const eExpo = (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));
const back = (t) => { const c = 1.70158 * 1.3; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
const rnd = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const fill = (c, a = 1) => { g.globalAlpha = a; g.fillStyle = c; g.fillRect(0, 0, W, H); g.globalAlpha = 1; };
// picture covering the frame; zoom about a focus point (fx, fy in 0..1 of the picture)
function cover(im, zoom = 1, fx = 0.5, fy = 0.5, a = 1, dx = 0, dy = 0) {
  const s = Math.max(W / im.width, H / im.height) * zoom, w = im.width * s, h = im.height * s;
  let x = W / 2 - fx * w + dx, y = H / 2 - fy * h + dy;
  x = Math.min(0, Math.max(W - w, x)); y = Math.min(0, Math.max(H - h, y));
  g.globalAlpha = a; g.drawImage(im, x, y, w, h); g.globalAlpha = 1;
}
// cut-out centred at (cx, cy) px, height hh px
function sprite(im, cx, cy, hh, a = 1, rot = 0, flip = false) {
  const s = hh / im.height; g.save(); g.translate(cx, cy); if (rot) g.rotate(rot); if (flip) g.scale(-1, 1);
  g.globalAlpha = a; g.drawImage(im, -im.width * s / 2, -hh / 2, im.width * s, hh); g.restore(); g.globalAlpha = 1;
}
function glow(cx, cy, r, col, a = 1, mode = "lighter") {
  const gr = g.createRadialGradient(cx, cy, 0, cx, cy, r); gr.addColorStop(0, col); gr.addColorStop(1, "rgba(0,0,0,0)");
  g.save(); g.globalCompositeOperation = mode; g.globalAlpha = a; g.fillStyle = gr; g.fillRect(cx - r, cy - r, r * 2, r * 2); g.restore();
}
function text(str, x, y, px, col, opt = {}) {
  g.save(); g.font = `${opt.w || 800} ${px}px ${opt.font || "BarlowC"}`; g.textAlign = opt.align || "center"; g.textBaseline = "middle";
  if (opt.ls) g.letterSpacing = opt.ls + "px"; g.globalAlpha = opt.a ?? 1; g.fillStyle = col; g.fillText(str, x, y); g.restore();
}
function vignette(a = 0.5) {
  const gr = g.createRadialGradient(W / 2, H / 2, M * 0.45, W / 2, H / 2, Math.hypot(W, H) / 2);
  gr.addColorStop(0, "rgba(0,0,0,0)"); gr.addColorStop(1, `rgba(0,0,0,${a})`); g.fillStyle = gr; g.fillRect(0, 0, W, H);
}
// film grain: four seeded noise tiles cycled by frame
const GR = [0, 1, 2, 3].map((k) => { const c = document.createElement("canvas"); c.width = c.height = 256; const x = c.getContext("2d"), d = x.createImageData(256, 256);
  for (let i = 0; i < 65536; i++) { const v = rnd(i * 4 + k * 70001) * 255; d.data[i * 4] = d.data[i * 4 + 1] = d.data[i * 4 + 2] = v; d.data[i * 4 + 3] = 255; } x.putImageData(d, 0, 0); return c; });
function grain(f, a = 0.07) { g.save(); g.globalCompositeOperation = "overlay"; g.globalAlpha = a; g.fillStyle = g.createPattern(GR[Math.floor(f) % 4], "repeat"); g.translate((Math.floor(f) * 37) % 256, (Math.floor(f) * 91) % 256); g.fillRect(-256, -256, W + 512, H + 512); g.restore(); }
function invert() { g.save(); g.globalCompositeOperation = "difference"; g.fillStyle = "#fff"; g.fillRect(0, 0, W, H); g.restore(); }
// which item of a run of fast cuts shows at frame f; the SAFE cut drops items until each holds 8 frames or more
function pick(items, f, a, b) { let n = items.length; if (SAFE) n = Math.max(1, Math.min(n, Math.floor((b - a) / 8))); const step = (b - a) / n; const i = Math.min(n - 1, Math.floor((f - a) / step));
  return { item: items[Math.round(i * (items.length - 1) / Math.max(1, n - 1))] ?? items[0], i, local: (f - a - i * step) / step, start: a + i * step }; }
function rrect(x, y, w, h, r) { g.beginPath(); g.roundRect(x, y, w, h, r); }
function label(name, line, f, a, b, dark = true) {
  const t = eOut(prog(f, a + 4, a + 14)) * (1 - prog(f, b - 6, b - 1)); if (t <= 0) return;
  const x = TALL ? W / 2 : W * 0.06, y = TALL ? H * 0.115 : H * 0.86, al = TALL ? "center" : "left", col = dark ? PAPER : INK;
  text(name, x, y + (1 - t) * 18, M * 0.1, col, { a: t, align: al, ls: 1 });
  text(line, x + (TALL ? 0 : 3), y + M * 0.075 + (1 - t) * 18, M * 0.026, col, { a: t * 0.72, align: al, font: "Inter", w: 500 });
}

// ---------- scenes ----------
function warning(f) {
  fill(INK);
  if (SAFE) { const t = prog(f, 0, S.astronaut.end); sprite(IM["moon-disc"], W / 2, H / 2, M * lerp(0.5, 0.56, t), eIO(prog(f, 0, 12)) * 0.9); return; }
  const on = f >= 2 && f < 12, flip = Math.floor(f) === 6 || Math.floor(f) === 7;
  if (flip) fill(PAPER);
  if (on) { const col = flip ? INK : PAPER, px = TALL ? M * 0.2 : M * 0.2;
    if (TALL) { text("EXTREME", W / 2, H / 2 - px * 1.0, px, col); text("FLASH", W / 2, H / 2, px, col); text("WARNING", W / 2, H / 2 + px * 1.0, px, col); }
    else { text("EXTREME FLASH", W / 2, H / 2 - px * 0.5, px, col); text("WARNING", W / 2, H / 2 + px * 0.5, px, col); } }
}
function astronaut(f) {
  const s = S.astronaut, t = prog(f, s.start, s.end); fill(INK);
  sprite(IM["moon-disc"], W / 2, H * 0.47, M * lerp(0.56, 0.62, t), 0.95);
  glow(W / 2, H * 0.47, M * 0.75, "rgba(244,241,237,0.35)", 0.6);
  g.save(); g.filter = "brightness(0.08)"; sprite(IM["astronaut-standing"], W / 2, H * lerp(0.6, 0.585, t), M * 0.62); g.restore();
  vignette(0.6);
}
function cells(f) {
  const s = S.cells, p = pick(["cells-grainy", "cells-glow"], f, s.start, s.end);
  if (p.item === "cells-grainy") { fill(PAPER); sprite(IM["cells-grainy"], W / 2, H / 2, M * lerp(0.7, 0.92, eOut(p.local)), 1, p.local * 0.12); }
  else { fill(INK); glow(W / 2, H / 2, M * 0.8, "rgba(255,190,120,0.5)", 0.5 + 0.3 * p.local); sprite(IM["cells-glow"], W / 2, H / 2, M * lerp(0.8, 1.25, eIn(p.local)), 1, -p.local * 0.1); }
}
const WALK = ["walker-early-human", "walker-painter", "walker-photographer", "walker-director"];
function walkers(f) {
  const s = S.walkers, p = pick(WALK, f, s.start, s.end), all = prog(f, s.start, s.end); fill(PAPER);
  const gy = H * 0.84, hh = M * 0.72, baseX = W * (TALL ? 0.5 : 0.5);
  g.fillStyle = INK; g.fillRect(0, gy, W, Math.max(2, M * 0.004));
  // the ones before trail behind, fading, so the line reads as one walk through time
  const idx = WALK.indexOf(p.item);
  for (let k = Math.max(0, idx - 2); k < idx; k++) sprite(IM[WALK[k]], baseX + (idx - k) * M * 0.2 - all * M * 0.1, gy - hh / 2, hh, 0.14 / (idx - k));
  sprite(IM[p.item], baseX - all * M * 0.1 - p.local * M * 0.02, gy - hh / 2, hh);
  const yrs = { "walker-early-human": "FIRE", "walker-painter": "PAINT", "walker-photographer": "FILM", "walker-director": "CAMERA" };
  text(yrs[p.item], TALL ? W / 2 : W * 0.86, TALL ? H * 0.1 : H * 0.16, M * 0.11, INK, { align: TALL ? "center" : "right" });
}
function brain(f) {
  const s = S.brain, t = prog(f, s.start, s.end); fill(INK);
  glow(W / 2, H * 0.45, M * 0.8, "rgba(192,7,7,0.55)", 0.35 + 0.3 * t);
  sprite(IM["brain-hands"], W / 2, H * 0.52, M * lerp(0.62, 0.8, eOut(t)));
  vignette(0.5);
}
function runnerAt(f, a = 1) {
  const s = S.runner, t = prog(f, s.start, S.dissolve.end); fill(PAPER, a);
  const x = lerp(W * 0.22, W * 0.72, t), y = H * 0.52, hh = M * 0.62;
  g.fillStyle = INK; for (let i = 0; i < 9; i++) { const ly = H * (0.2 + rnd(i + 5) * 0.62), lw = M * (0.2 + rnd(i + 9) * 0.5); g.globalAlpha = 0.5 * a; g.fillRect(x - M * 0.2 - lw - rnd(i) * M * 0.3 - t * M * 0.4, ly, lw, Math.max(2, M * 0.004)); }
  g.globalAlpha = 1;
  for (let k = 3; k >= 1; k--) sprite(IM["runner"], x - k * M * 0.035, y, hh, 0.12 * a, 0, true);
  sprite(IM["runner"], x, y, hh, a, 0, true);
}
function runner(f) { runnerAt(f); }
// the still frame breaks into blocks that turn into the navy wall
function dissolve(f) {
  const s = S.dissolve, t = prog(f, s.start, s.end); runnerAt(f);
  const cols = TALL ? 12 : 20, sz = W / cols, rows = Math.ceil(H / sz);
  g.save(); g.beginPath();
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { const k = rnd(r * 131 + c * 17 + 3) * 0.75; if (t > k) { const q = clamp((t - k) / 0.25), d = sz * (1 - q) / 2; g.rect(c * sz + d, r * sz + d, sz * q + 0.5, sz * q + 0.5); } }
  g.clip(); wall(); g.restore();
}
function wall() { fill(NAVY); cover(IM["tile-wall"], TALL ? 1 : 1, 0.5, 0.5, 0.85); g.save(); g.globalCompositeOperation = "multiply"; fill("#27407a"); g.restore(); }
const UNDER = [["desert-astronaut-a", 0.5, 0.55], ["planet-reveal", 0.5, 0.5], ["desert-astronaut-b", 0.62, 0.55], ["orbit-sunrise", 0.4, 0.5]];
const wallCv = document.createElement("canvas"); wallCv.width = W; wallCv.height = H;
function cascade(f) {
  const s = S.cascade, t = prog(f, s.start, s.end), p = pick(UNDER, f, s.start, s.end);
  cover(IM[p.item[0]], 1.04 + 0.05 * p.local, p.item[1], p.item[2]);
  if (!SAFE && p.i === 1 && p.local < 0.21) invert();
  // tiles let go from the top-left sweep and fall with gravity
  const cols = TALL ? 12 : 20, sz = W / cols, rows = Math.ceil(H / sz), dur = s.end - s.start, wc = wallCv.getContext("2d");
  if (!wallCv.done) { const keep = g.getImageData(0, 0, W, H); wall(); wc.drawImage(cv, 0, 0); g.putImageData(keep, 0, 0); wallCv.done = true; }
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const go = (rnd(r * 53 + c * 7) * 0.55 + (c / cols) * 0.2 + (1 - r / rows) * 0.12) * dur * 0.82, q = (f - s.start - go) / 30;
    let y = r * sz, x = c * sz, rot = 0, a = 1;
    if (q > 0) { y += 0.5 * 9 * H * q * q; x += (rnd(c + r * 9) - 0.5) * sz * 3 * q; rot = (rnd(c * 3 + r) - 0.5) * 5 * q; a = 1 - clamp(q * 1.6 - 0.9); if (y > H + sz) continue; }
    g.save(); g.translate(x + sz / 2, y + sz / 2); g.rotate(rot); g.globalAlpha = a; g.drawImage(wallCv, c * sz, r * sz, sz, sz, -sz / 2, -sz / 2, sz + 0.6, sz + 0.6);
    if (q > 0) { g.globalAlpha = a * 0.25; g.fillStyle = "#000"; g.fillRect(-sz / 2, -sz / 2, sz, sz); } g.restore();
  }
}
// what floats around the eclipse: name, position (fraction of frame), height (of M), pop frame, base turn
const FLOAT = TALL ? [
  ["astronaut-standing", 0.5, 0.8, 0.5, 0], ["astronaut-reach", 0.22, 0.33, 0.24, -0.2], ["astronaut-tumble", 0.8, 0.3, 0.22, 0.3],
] : [
  ["astronaut-standing", 0.5, 0.86, 0.56, 0], ["astronaut-reach", 0.2, 0.34, 0.34, -0.2], ["astronaut-tumble", 0.8, 0.3, 0.3, 0.3],
];
const CORE = [0.5, TALL ? 0.497 : 0.496];
function heroBase(f) {
  const s = S.hero, t = prog(f, s.start, S.redout.end);
  cover(IM["hero-eclipse-seedream"], (TALL ? 1.25 : 1.0) + 0.07 * t, CORE[0], CORE[1]);
}
function floatPos(i, f) { const o = FLOAT[i]; return [W * o[1] + Math.sin(f / 31 + i * 2.1) * M * 0.012, H * o[2] + Math.cos(f / 27 + i * 1.3) * M * 0.014, o[4] + Math.sin(f / 43 + i) * 0.05]; }
function hero(f) {
  const s = S.hero; heroBase(f);
  if (f < s.start + 5 && !SAFE) fill("#fff", 0.5 * (1 - prog(f, s.start, s.start + 5)));
    for (let i = FLOAT.length - 1; i >= 0; i--) {
    const o = FLOAT[i], pop = TL.popins[i]; if (f < pop) continue;
    const q = prog(f, pop, pop + 9), sc = back(q), [x, y, r] = floatPos(i, f);
    if (q < 1 && !SAFE) glow(x, y, M * o[3] * 0.7, "rgba(255,255,255,0.8)", (1 - q) * 0.7);
    sprite(IM[o[0]], x, y, M * o[3] * sc, clamp(q * 3), r);
  }
  vignette(0.45);
}
// the camera dives into the dark disc of the eclipse; out of that dark, Core's memory lights up
function redout(f) {
  const s = S.redout, cx = W * CORE[0], cy = H * CORE[1], z = 1 + 22 * eIn(prog(f, s.start, s.start + 13));
  g.save(); g.translate(cx, cy); g.scale(z, z); g.translate(-cx, -cy); hero(f); g.restore();
  fill("#000", eIn(prog(f, s.start + 4, s.start + 12)));
  const m = prog(f, s.start + 10, s.end); if (m > 0) memoryShot(eIO(m) * 0.55, f, eOut(m));
}
// Memory page: the orb sits at (1336, 1102) in the 2880x1800 capture
function memoryShot(k, f, a = 1) {
  const im = IM["cap-memory"], fx = 1336 / 2880, fy = 1102 / 1800, z = lerp(TALL ? 9 : 7, TALL ? 2.4 : 1.9, eOut(k));
  cover(im, z, fx, fy, a, 0, TALL ? 0 : 0);
  const pulse = 0.5 + 0.5 * Math.sin(f / 9); glow(W / 2, H / 2, M * 0.16 * z * (1 + 0.05 * pulse), "rgba(255,30,20,0.55)", a * (0.35 + 0.25 * pulse));
}
function core(f) {
  const s = S.core, t = prog(f, s.start, s.end); fill(INK); memoryShot(0.55 + 0.45 * eOut(prog(f, s.start, s.start + 24)) + 0, f);
  // drift
  vignette(0.5); label("CORE", "Remembers your brand, your characters, your taste.", f, s.start, s.end);
}
// an app screen as a floating window: crop (x, y, w, h in capture px), drawn to fit with a slow move
function windowShot(im, crop, f, a, b, opt = {}) {
  const t = prog(f, a, b), inn = eExpo(prog(f, a, a + 10)), out = SAFE ? eIn(prog(f, b - 8, b)) : eIn(prog(f, b - 5, b));
  const [cx0, cy0, cw, ch] = crop, pad = M * (opt.pad ?? 0.045), availW = W - pad * 2, availH = H - pad * 2 - (TALL ? H * 0.2 : H * 0.1);
  const s = Math.min(availW / cw, availH / ch) * lerp(opt.z0 ?? 0.96, opt.z1 ?? 1.03, t), w = cw * s, h = ch * s;
  const x = W / 2 - w / 2 + (1 - inn) * W * 0.9 - out * W * 0.9, y = (TALL ? H * 0.54 : H * 0.455) - h / 2;
  g.save(); g.shadowColor = "rgba(0,0,0,0.45)"; g.shadowBlur = M * 0.08; g.shadowOffsetY = M * 0.03; rrect(x, y, w, h, M * 0.022); g.fillStyle = "#000"; g.fill(); g.restore();
  g.save(); rrect(x, y, w, h, M * 0.022); g.clip(); g.drawImage(im, cx0, cy0, cw, ch, x, y, w, h); g.restore();
  g.save(); rrect(x, y, w, h, M * 0.022); g.strokeStyle = opt.light ? "rgba(0,0,0,0.12)" : "rgba(255,255,255,0.14)"; g.lineWidth = 2; g.stroke(); g.restore();
}
const X0 = 545; // right of the sidebar in a capture
function atlas(f) {
  const s = S.atlas, d = (s.end - s.start); fill(PAPER);
  const st = f < s.start + d * 0.27 ? "cap-atlas-1-open" : f < s.start + d * 0.5 ? "cap-atlas-2-working" : "cap-atlas-3-answer";
  windowShot(IM[st], TALL ? [1880, 130, 1000, 1670] : [X0, 0, 2880 - X0, 1800], f, s.start, s.end, { light: true });
  label("ATLAS", "Your creative partner. He proposes, you approve.", f, s.start, s.end, false);
}
// the canvas fills the frame; the camera travels from the ingredients to the finished picture
function canvasS(f) {
  const s = S.canvas, t = eIO(prog(f, s.start + 4, s.end - 6)); fill(INK);
  const inn = eExpo(prog(f, s.start, s.start + 10)), out = eIn(prog(f, s.end - (SAFE ? 8 : 5), s.end));
  g.save(); g.translate((1 - inn) * W * 0.9 - out * W * 0.9, 0);
  cover(IM["cap-canvas-1-flow"], TALL ? 1.0 : lerp(1.75, 1.5, t), lerp(TALL ? 0.16 : 0.3, TALL ? 0.84 : 0.72, t), TALL ? 0.5 : lerp(0.52, 0.47, t));
  g.restore();
  const gr = g.createLinearGradient(0, H * 0.7, 0, H); gr.addColorStop(0, "rgba(0,0,0,0)"); gr.addColorStop(1, "rgba(0,0,0,0.75)"); if (!TALL) { g.fillStyle = gr; g.fillRect(0, H * 0.7, W, H * 0.3); }
  label("CANVAS", "Wire characters, products and scenes into one flow.", f, s.start, s.end);
}
function audio(f) {
  const s = S.audio; fill(DEEP); glow(W / 2, H * 0.4, M * 0.9, "rgba(192,7,7,0.5)", 0.6);
  windowShot(IM["cap-audio-1"], TALL ? [1130, 200, 1160, 1580] : [X0, 130, 2880 - X0, 1670], f, s.start, s.end);
  label("AUDIO STUDIO", "Voices, sound and music.", f, s.start, s.end);
}
function shotmap(f) {
  const s = S.shotmap; fill(PAPER);
  windowShot(IM["cap-shotmap-stage"], TALL ? [900, 600, 1080, 1010] : [905, 570, 1070, 1030], f, s.start, s.end, { light: true });
  label("SHOTMAP", "Direct the camera in 3D, then generate.", f, s.start, s.end, false);
}
const BURST = [["o", "rocket-fictional", PAPER], ["p", "out-0"], ["o", "race-car", INK], ["p", "out-1"], ["o", "rocket-shuttle", DEEP], ["p", "out-2"], ["o", "paraglider", PAPER], ["p", "out-3"], ["o", "camera-tripod", PAPER], ["p", "out-4"], ["o", "rocket-steel", INK], ["p", "out-6", "neg"]];
function burst(f) {
  const s = S.burst, p = pick(BURST, f, s.start, s.end), it = p.item, z = eOut(p.local);
  if (it[0] === "p") { cover(IM[it[1]], 1.12 - 0.08 * z, 0.5, 0.45); if (it[2] === "neg" && !SAFE) invert(); }
  else { fill(it[2]); const im = IM[it[1]], wide = im.width > im.height, hh = wide ? (TALL ? W * 0.9 : W * 0.62) * im.height / im.width : H * (TALL ? 0.62 : 0.84);
    if (it[2] === INK) glow(W / 2, H / 2, M * 0.7, "rgba(192,7,7,0.6)", 0.6);
    const rise = /rocket/.test(it[1]) ? lerp(H * 0.08, -H * 0.03, z) : 0, slide = it[1] === "race-car" ? lerp(W * 0.12, -W * 0.03, z) : 0;
    sprite(im, W / 2 + slide, H / 2 + rise, hh * lerp(0.92, 1.04, z)); }
  if (!SAFE && p.local < 0.18 && it[0] === "o" && p.i % 4 === 2) invert();
}
function finale(f) {
  const s = S.finale, t = prog(f, s.start, s.end);
  cover(IM["finale-plate"], lerp(1.0, 1.08, t), 0.5, 0.55);
  g.save(); g.globalCompositeOperation = "screen"; const gr = g.createLinearGradient(0, H * 0.45, 0, H); gr.addColorStop(0, "rgba(255,160,90,0)"); gr.addColorStop(1, `rgba(255,150,80,${0.22 + 0.1 * Math.sin(f / 11)})`); g.fillStyle = gr; g.fillRect(0, 0, W, H); g.restore();
  vignette(0.55);
  const a = SAFE ? 1 - eOut(prog(f, s.start, s.start + 12)) : 1 - eOut(prog(f, s.start, s.start + 6)); if (a > 0) fill(SAFE ? INK : "#fff", a);
  fill(INK, eIn(prog(f, s.end - 8, s.end)));
}
function endcard(f) {
  const s = S.endcard; fill(INK);
  const a1 = prog(f, s.start + 4, s.start + (SAFE ? 12 : 6)), a2 = prog(f, TL.line2, TL.line2 + (SAFE ? 8 : 4)), px = M * (TALL ? 0.165 : 0.19), cy = H * 0.5;
  glow(W / 2, cy, M * 0.9, "rgba(192,7,7,0.5)", 0.35 * a2);
  sprite(IM["logo"], W / 2, cy - px * 1.9, M * 0.22, eOut(prog(f, s.start + 2, s.start + 14)));
  text("STOP PROMPTING.", W / 2, cy - px * 0.42 + (1 - eOut(a1)) * 12, px, PAPER, { a: a1 });
  text("START DIRECTING.", W / 2, cy + px * 0.55 + (1 - eOut(a2)) * 12, px, RED, { a: a2 });
  text("ECLIPSE STUDIO", W / 2, cy + px * 1.6, M * 0.036, PAPER, { a: 0.8 * prog(f, TL.line2 + 8, TL.line2 + 18), font: "Inter", w: 500, ls: M * 0.008 });
  fill("#000", eIO(prog(f, TL.fade, s.end - 1)));
}
const DRAW = { warning, astronaut, cells, walkers, brain, runner, dissolve, cascade, hero, redout, core, atlas, canvas: canvasS, audio, shotmap, burst, finale, endcard };
const NOGRAIN = new Set(["atlas", "canvas", "audio", "shotmap", "endcard", "warning"]);
function drawAt(f) {
  const sc = TL.scenes.find((s) => f >= s.start && f < s.end) || TL.scenes[TL.scenes.length - 1];
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = "source-over"; g.filter = "none";
  DRAW[sc.id](f); if (!NOGRAIN.has(sc.id)) grain(f, 0.08); return sc;
}
// one output frame = several moments inside the frame averaged together (camera shutter), so fast motion smears instead of stepping
window.renderFrame = (n) => {
  const sc = TL.scenes.find((s) => n >= s.start && n < s.end) || TL.scenes[TL.scenes.length - 1], SUB = sc.blur ? 5 : 1;
  if (SUB === 1) { drawAt(n); } else { ag.clearRect(0, 0, W, H); for (let k = 0; k < SUB; k++) { drawAt(Math.min(n + (k / SUB) * 0.6, sc.end - 0.001)); ag.globalAlpha = 1 / (k + 1); ag.drawImage(cv, 0, 0); } ag.globalAlpha = 1; g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = "copy"; g.drawImage(acc, 0, 0); g.globalCompositeOperation = "source-over"; }
  return cv.toDataURL("image/jpeg", 0.95).slice(23);
};
window.ready = (async () => {
  await Promise.all([new FontFace("BarlowC", "url(fonts/barlow-condensed-latin-800-normal.woff2)", { weight: "800" }).load(), new FontFace("Inter", "url(fonts/Inter-latin.woff2)", { weight: "100 900" }).load()].map((p) => p.then((ff) => document.fonts.add(ff))));
  await Promise.all([...NAMES.map((n) => [n, `work/${n}.png`]), ...OUTS.map((n) => [n, `work/${n}.jpg`])].map(([n, src]) => new Promise((ok, no) => { const i = new Image(); i.onload = () => { IM[n] = i; ok(); }; i.onerror = () => no(new Error("missing " + src)); i.src = src; })));
  return true;
})();
