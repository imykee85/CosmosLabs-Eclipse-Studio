// Eclipse launch film, version 2: the product is the hero. A prompt is typed, results pop out as floating cards, each part of the studio gets
// one short line. Every frame is drawn here on one canvas from the frame number alone (no clocks, seeded randomness). Timing: timeline.json, 30 fps.
/* global TL, CFG */
const W = CFG.w, H = CFG.h, M = Math.min(W, H), TALL = H > W;
const cv = document.getElementById("c"); cv.width = W; cv.height = H;
const g = cv.getContext("2d");
const BG = "#060606", PAPER = "#F4F1ED", RED = "#c00707", MUTE = "rgba(244,241,237,0.5)";
const S = Object.fromEntries(TL.scenes.map((s) => [s.id, s]));
const IM = {};
const CARDS = 28, HITS = ["hands", "vitruvian", "eye", "bird"], SEQ = { hero: 120, camp: 90, film: 90 };

// ---------- helpers ----------
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
const prog = (f, a, b) => clamp((f - a) / (b - a));
const eOut = (t) => 1 - Math.pow(1 - t, 3), eIn = (t) => t * t * t, eIO = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const eExpo = (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));
const spring = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : 1 - Math.exp(-7 * t) * Math.cos(9 * t)); // settles with one small overshoot
const rnd = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const seq = (name, f) => IM[`${name}-${String(1 + (Math.max(0, Math.floor(f)) % SEQ[name])).padStart(3, "0")}`];
function rr(x, y, w, h, r) { g.beginPath(); g.roundRect(x, y, w, h, r); }
function bg(f) {
  g.fillStyle = BG; g.fillRect(0, 0, W, H);
  const x = W * (0.5 + 0.18 * Math.sin(f / 140)), y = H * (0.55 + 0.1 * Math.cos(f / 170)), r = Math.hypot(W, H) * 0.55;
  const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, "rgba(192,7,7,0.16)"); gr.addColorStop(1, "rgba(192,7,7,0)"); g.fillStyle = gr; g.fillRect(0, 0, W, H);
}
// a picture as a rounded card, centred at (cx, cy), w x h, cropped to fill
function card(im, cx, cy, w, h, o = {}) {
  if (!im || w <= 1 || h <= 1) return; const a = o.a ?? 1; if (a <= 0) return;
  const r = o.r ?? Math.min(w, h) * 0.06, s = Math.max(w / im.width, h / im.height), sw = w / s, sh = h / s, fy = o.fy ?? 0.4;
  g.save(); g.translate(cx, cy); if (o.rot) g.rotate(o.rot); g.globalAlpha = a;
  if (o.shadow !== false) { g.save(); g.shadowColor = "rgba(0,0,0,0.6)"; g.shadowBlur = M * 0.05; g.shadowOffsetY = M * 0.018; rr(-w / 2, -h / 2, w, h, r); g.fillStyle = "#000"; g.fill(); g.restore(); }
  g.save(); rr(-w / 2, -h / 2, w, h, r); g.clip(); g.drawImage(im, (im.width - sw) / 2, (im.height - sh) * fy, sw, sh, -w / 2, -h / 2, w, h); g.restore();
  rr(-w / 2, -h / 2, w, h, r); g.strokeStyle = "rgba(255,255,255,0.14)"; g.lineWidth = Math.max(1.5, M * 0.0016); g.stroke();
  g.restore(); g.globalAlpha = 1;
}
// part of an app capture (sx, sy, sw, sh) as a card of width w
function shot(im, crop, cx, cy, w, o = {}) {
  const [sx, sy, sw, sh] = crop, h = w * sh / sw, a = o.a ?? 1, r = o.r ?? M * 0.022; if (a <= 0) return;
  g.save(); g.translate(cx, cy); g.globalAlpha = a;
  g.save(); g.shadowColor = "rgba(0,0,0,0.65)"; g.shadowBlur = M * 0.07; g.shadowOffsetY = M * 0.025; rr(-w / 2, -h / 2, w, h, r); g.fillStyle = "#000"; g.fill(); g.restore();
  g.save(); rr(-w / 2, -h / 2, w, h, r); g.clip(); g.drawImage(im, sx, sy, sw, sh, -w / 2, -h / 2, w, h); g.restore();
  rr(-w / 2, -h / 2, w, h, r); g.strokeStyle = "rgba(255,255,255,0.16)"; g.lineWidth = Math.max(1.5, M * 0.0016); g.stroke(); g.restore(); g.globalAlpha = 1;
}
function text(str, x, y, px, col, o = {}) {
  g.save(); g.font = `${o.w || 500} ${px}px Inter`; g.textAlign = o.align || "center"; g.textBaseline = "middle"; g.letterSpacing = (o.ls ?? -px * 0.02) + "px";
  g.globalAlpha = o.a ?? 1; g.fillStyle = col; g.fillText(str, x, y); g.restore();
}
// a line that arrives word by word; `dim` words stay grey
function line(str, f, a, b, o = {}) {
  const words = str.split(" "), px = o.px ?? M * (TALL ? 0.064 : 0.06), y = o.y ?? H * (TALL ? 0.86 : 0.875), out = 1 - prog(f, b - 8, b - 1);
  g.save(); g.font = `${o.w || 600} ${px}px Inter`; g.letterSpacing = -px * 0.035 + "px"; g.textBaseline = "middle";
  const sp = g.measureText(" ").width, ws = words.map((w) => g.measureText(w.replace(/[\[\]]/g, "")).width), tot = ws.reduce((p, c) => p + c, 0) + sp * (words.length - 1);
  let x = (o.x ?? W / 2) - tot / 2;
  let dimOn = false; words.forEach((w, i) => { const t = spring(prog(f, a + i * 2.5, a + i * 2.5 + 14)); if (w.startsWith("[")) dimOn = true; const dim = dimOn; if (w.endsWith("]")) dimOn = false; g.globalAlpha = clamp(t * 2.5) * out; g.fillStyle = dim ? MUTE : PAPER; g.fillText(w.replace(/[\[\]]/g, ""), x, y + (1 - t) * px * 0.9); x += ws[i] + sp; });
  g.restore();
}
function tag(str, x, y, a = 1) { text(str, x, y, M * 0.017, MUTE, { a, w: 600, ls: M * 0.003 }); }
function glow(cx, cy, r, col, a = 1) { const gr = g.createRadialGradient(cx, cy, 0, cx, cy, r); gr.addColorStop(0, col); gr.addColorStop(1, "rgba(0,0,0,0)"); g.save(); g.globalCompositeOperation = "lighter"; g.globalAlpha = a; g.fillStyle = gr; g.fillRect(cx - r, cy - r, r * 2, r * 2); g.restore(); }
function pointer(x, y, s = 1, a = 1) { // the arrow cursor
  const u = M * 0.0125 * s; g.save(); g.translate(x, y); g.globalAlpha = a; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, 17 * u / 10 * 1.9); g.lineTo(u * 0.85, u * 2.5); g.lineTo(u * 1.45, u * 3.9); g.lineTo(u * 2.05, u * 3.6); g.lineTo(u * 1.45, u * 2.3); g.lineTo(u * 2.6, u * 2.3); g.closePath();
  g.fillStyle = "#fff"; g.shadowColor = "rgba(0,0,0,0.6)"; g.shadowBlur = u; g.fill(); g.shadowBlur = 0; g.strokeStyle = "#000"; g.lineWidth = u * 0.22; g.stroke(); g.restore();
}

// ---------- the prompt box (drawn like Eclipse's own: dark field, + on the left, red send button) ----------
const PROMPT = TL.prompt;
function promptBox(cx, cy, w, typed, o = {}) {
  const h = w * 0.105, a = o.a ?? 1, x = cx - w / 2, y = cy - h / 2, px = h * 0.3;
  g.save(); g.globalAlpha = a;
  g.save(); g.shadowColor = "rgba(0,0,0,0.6)"; g.shadowBlur = M * 0.06; g.shadowOffsetY = M * 0.02; rr(x, y, w, h, h / 2); g.fillStyle = "#161616"; g.fill(); g.restore();
  rr(x, y, w, h, h / 2); g.strokeStyle = o.hot ? "rgba(192,7,7,0.9)" : "rgba(255,255,255,0.16)"; g.lineWidth = Math.max(2, M * 0.002); g.stroke();
  const pr = h * 0.29, pxc = x + h * 0.52; g.beginPath(); g.arc(pxc, cy, pr, 0, 7); g.strokeStyle = "rgba(255,255,255,0.3)"; g.stroke();
  g.strokeStyle = PAPER; g.beginPath(); g.moveTo(pxc - pr * 0.42, cy); g.lineTo(pxc + pr * 0.42, cy); g.moveTo(pxc, cy - pr * 0.42); g.lineTo(pxc, cy + pr * 0.42); g.stroke();
  g.font = `500 ${px}px Inter`; g.textBaseline = "middle"; g.textAlign = "left"; g.letterSpacing = -px * 0.015 + "px"; const tx = x + h * 1.0;
  if (!typed.length && o.placeholder) { g.fillStyle = "rgba(244,241,237,0.35)"; g.fillText(o.placeholder, tx, cy + px * 0.04); }
  g.fillStyle = PAPER; g.fillText(typed, tx, cy + px * 0.04);
  if (o.caret) { const tw = g.measureText(typed).width; g.fillStyle = RED; g.fillRect(tx + tw + px * 0.12, cy - px * 0.6, Math.max(2, px * 0.09), px * 1.2); }
  const br = h * 0.33 * (o.press ?? 1), bx = x + w - h * 0.5; g.beginPath(); g.arc(bx, cy, br, 0, 7); g.fillStyle = typed.length ? RED : "#333"; g.fill();
  g.strokeStyle = "#fff"; g.lineWidth = Math.max(2, br * 0.13); g.lineCap = "round"; g.lineJoin = "round"; g.beginPath(); g.moveTo(bx, cy + br * 0.42); g.lineTo(bx, cy - br * 0.42); g.moveTo(bx - br * 0.36, cy - br * 0.08); g.lineTo(bx, cy - br * 0.44); g.lineTo(bx + br * 0.36, cy - br * 0.08); g.stroke();
  g.restore(); return { bx, by: cy, h };
}

// ---------- scenes ----------
function sPrompt(f) {
  const s = S.prompt, w = W * (TALL ? 0.92 : 0.64), inn = eOut(prog(f, s.start, s.start + 10));
  const n = Math.round(PROMPT.length * prog(f, s.start + 12, TL.typed)), press = f >= TL.click && f < TL.click + 5 ? 0.86 : 1;
  const b = promptBox(W / 2, H / 2 + (1 - inn) * M * 0.03, w, PROMPT.slice(0, n), { a: inn, caret: f < TL.click && Math.floor(f / 8) % 2 === 0 || n < PROMPT.length && f > s.start + 12, press, hot: f >= TL.click, placeholder: "Describe the shot you imagine…" });
  const pt = eIO(prog(f, TL.typed - 6, TL.click - 2)); pointer(lerp(W * 0.78, b.bx - M * 0.004, pt), lerp(H * 0.8, b.by + M * 0.002, pt), press, inn);
  if (f >= TL.click) glow(b.bx, b.by, M * 0.5 * eOut(prog(f, TL.click, s.end)), "rgba(192,7,7,0.9)", 0.5 * (1 - prog(f, TL.click, s.end)));
}
// the box rises, the pictures arrive
const FAN = TALL ? [[0.5, 0.36, 0.62], [0.27, 0.66, 0.4], [0.73, 0.66, 0.4], [0.5, 0.7, 0.36]] : [[0.5, 0.5, 0.6], [0.2, 0.52, 0.46], [0.8, 0.52, 0.46], [0.5, 0.5, 0.6]];
function sImages(f) {
  const s = S.images, up = eIO(prog(f, s.start, s.start + 12));
  promptBox(W / 2, lerp(H / 2, H * (TALL ? 0.075 : 0.105), up), W * (TALL ? 0.92 : 0.64) * lerp(1, 0.62, up), PROMPT, { a: lerp(1, 0.75, up) * (1 - prog(f, s.end - 8, s.end)), hot: false });
  const order = [1, 2, 0], pics = [IM["card-0"], IM["card-1"], IM["card-3"]], out = eIn(prog(f, s.end - 9, s.end));
  order.forEach((k) => { const st = s.start + 8 + (k === 0 ? 0 : k * 9 + 12), t = spring(prog(f, st, st + 18)), p = FAN[k], hh = M * p[2] * (TALL ? 1 : 1.12) * t * (1 - out * 0.4);
    card(pics[k], W * p[0] + (k === 1 ? -1 : k === 2 ? 1 : 0) * out * W * 0.5, H * (p[1] + 0.03) + (1 - t) * M * 0.08, hh * 0.72, hh, { rot: (k === 1 ? -0.07 : k === 2 ? 0.07 : 0) * t, a: clamp(t * 3) * (1 - out) }); });
  line("Images that look [directed.]", f, s.start + 30, s.end);
}
// four full-screen pictures in quick succession
function sHits(f) {
  const s = S.hits, step = (s.end - s.start) / HITS.length, i = Math.min(HITS.length - 1, Math.floor((f - s.start) / step)), t = (f - s.start - i * step) / step, im = IM[`hit-${HITS[i]}`];
  const sc = Math.max(W / im.width, H / im.height) * (1.16 - 0.14 * eExpo(t)), w = im.width * sc, h = im.height * sc; g.drawImage(im, (W - w) / 2, (H - h) / 2, w, h);
  const gr = g.createLinearGradient(0, H * 0.6, 0, H); gr.addColorStop(0, "rgba(0,0,0,0)"); gr.addColorStop(1, "rgba(0,0,0,0.65)"); g.fillStyle = gr; g.fillRect(0, H * 0.6, W, H * 0.4);
  line("Any style. [Any era.]", f, s.start + 4, s.end + 20);
}
function sVideo(f) {
  const s = S.video, ex = eIO(prog(f, TL.expand, TL.expand + 16)), lf = f - s.start;
  // two side clips, then the hero clip grows to fill the frame
  const sideA = (1 - ex) * clamp(spring(prog(f, s.start + 8, s.start + 24)) * 3), hs = M * (TALL ? 0.34 : 0.5);
  if (sideA > 0) { const t = spring(prog(f, s.start + 8, s.start + 24));
    card(seq("camp", lf), W * (TALL ? 0.24 : 0.2) - ex * W * 0.4, H * (TALL ? 0.68 : 0.5), hs * 0.5625 * t, hs * t, { a: sideA, rot: -0.06 });
    card(seq("film", lf), W * (TALL ? 0.76 : 0.8) + ex * W * 0.4, H * (TALL ? 0.68 : 0.5), hs * 0.5625 * t, hs * t, { a: sideA, rot: 0.06 }); }
  const t = spring(prog(f, s.start, s.start + 18)), h0 = M * (TALL ? 0.56 : 0.72) * t, w0 = h0 * 0.5625, w = lerp(w0, W * 1.02, ex), h = lerp(h0, H * 1.02, ex);
  card(seq("hero", lf), W / 2, lerp(H * (TALL ? 0.36 : 0.47), H / 2, ex), w, h, { r: lerp(Math.min(w0, h0) * 0.06, 0, ex), a: clamp(t * 3), fy: 0.45 });
  if (ex > 0.5) { const gr = g.createLinearGradient(0, H * 0.6, 0, H); gr.addColorStop(0, "rgba(0,0,0,0)"); gr.addColorStop(1, "rgba(0,0,0,0.7)"); g.globalAlpha = (ex - 0.5) * 2; g.fillStyle = gr; g.fillRect(0, H * 0.6, W, H * 0.4); g.globalAlpha = 1; }
  line("Video that moves [like film.]", f, s.start + 22, s.end);
  g.fillStyle = "#000"; g.globalAlpha = eIn(prog(f, s.end - 8, s.end)); g.fillRect(0, 0, W, H); g.globalAlpha = 1;
}
function orb(cx, cy, r, f) { // Audio Studio's voice orb
  const gr = g.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.05, cx, cy, r); gr.addColorStop(0, "#ffb3cf"); gr.addColorStop(0.35, "#ff3d86"); gr.addColorStop(0.75, "#c00707"); gr.addColorStop(1, "#5a0320");
  glow(cx, cy, r * 2.4, "rgba(255,40,90,0.5)", 0.5 + 0.2 * Math.sin(f / 5)); g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fillStyle = gr; g.fill();
}
function sSound(f) {
  const s = S.sound, inn = eOut(prog(f, s.start, s.start + 12)), out = 1 - eIn(prog(f, s.end - 8, s.end)), cy = H * (TALL ? 0.42 : 0.46), n = TALL ? 41 : 73, span = W * 0.8, bw = span / n;
  for (let i = 0; i < n; i++) { const d = Math.abs(i - (n - 1) / 2) / ((n - 1) / 2), env = Math.pow(1 - d, 0.7), amp = (0.25 + 0.75 * Math.abs(Math.sin(i * 0.9 + f / 3.1) * Math.sin(i * 0.37 - f / 5.3))) * env;
    const hh = M * 0.34 * amp * inn * out + 3, x = W / 2 - span / 2 + i * bw; if (d < 0.2) continue; g.fillStyle = i % 5 === 0 ? RED : PAPER; g.globalAlpha = (0.35 + 0.65 * env) * out; rr(x + bw * 0.25, cy - hh / 2, bw * 0.5, hh, bw * 0.25); g.fill(); }
  g.globalAlpha = 1; orb(W / 2, cy, M * 0.11 * spring(prog(f, s.start, s.start + 18)) * (1 + 0.04 * Math.sin(f / 2.3)) * out, f);
  line("Voices, sound [and music.]", f, s.start + 12, s.end);
}
function sOne(f) { const s = S.one; line("One studio.", f, s.start + 2, s.end, { px: M * (TALL ? 0.13 : 0.15), y: H / 2, w: 600 }); }
// Canvas: the character and the products are wired into every shot
function wire(x1, y1, x2, y2, t) { if (t <= 0) return; const mx = (x1 + x2) / 2; g.save(); g.beginPath(); const N = 40, k = Math.ceil(N * t);
  for (let i = 0; i <= k; i++) { const u = Math.min(t, i / N), a = 1 - u, x = a * a * a * x1 + 3 * a * a * u * mx + 3 * a * u * u * mx + u * u * u * x2, y = a * a * a * y1 + 3 * a * a * u * y1 + 3 * a * u * u * y2 + u * u * u * y2; i ? g.lineTo(x, y) : g.moveTo(x, y); if (i === k) { g.strokeStyle = "rgba(244,241,237,0.42)"; g.lineWidth = Math.max(2, M * 0.0022); g.stroke(); g.beginPath(); g.arc(x, y, M * 0.006, 0, 7); g.fillStyle = RED; g.fill(); } } g.restore(); }
// Canvas: the real screen. The camera jumps node to node (character, products, full-body generator, image generator), then pulls back to the whole flow.
const CAM = TALL
  ? [[0, 530, 900, 1.7], [30, 1545, 1010, 1.0], [62, 2590, 960, 1.45], [92, 3300, 1080, 1.45], [122, 1920, 1080, 0.32]]
  : [[0, 530, 900, 2.7], [30, 1545, 1010, 1.7], [62, 2590, 960, 2.0], [92, 3300, 1080, 2.0], [122, 1920, 1080, 1.0]];
const CAMLINE = ["One character.", "Real products.", "A full-body look.", "Then every shot.", "Same face. Same suit. [Every shot.]"];
function sCanvas(f) {
  const s = S.canvas, im = IM["cap-canvas"], lf = f - s.start; let i = 0; while (i < CAM.length - 1 && lf >= CAM[i + 1][0]) i++;
  const a = CAM[Math.max(0, i - 1)], b = CAM[i], t = i === 0 ? 1 : eIO(prog(lf, b[0], b[0] + 13)), hold = clamp((lf - b[0]) / 40);
  g.fillStyle = "#040404"; g.fillRect(-W, -H, W * 3, H * 3);
  const cx = lerp(a[1], b[1], t), cy = lerp(a[2], b[2], t), z = lerp(a[3], b[3], t) * (1 + 0.035 * hold), sc = Math.max(W / im.width, H / im.height) * z;
  g.drawImage(im, W / 2 - cx * sc, H * (TALL ? 0.44 : 0.47) - cy * sc, im.width * sc, im.height * sc);
  const gr = g.createLinearGradient(0, H * 0.68, 0, H); gr.addColorStop(0, "rgba(0,0,0,0)"); gr.addColorStop(0.75, "rgba(0,0,0,0.85)"); gr.addColorStop(1, "rgba(0,0,0,0.92)"); g.fillStyle = gr; g.fillRect(0, H * 0.68, W, H * 0.32);
  const end = i < CAM.length - 1 ? s.start + CAM[i + 1][0] : s.end; line(CAMLINE[i], f, s.start + b[0] + 6, end + (i < CAM.length - 1 ? 4 : 0));
}
function atlasBall(cx, cy, r, f) { // Atlas: a white ball with two eyes that blinks and glances
  const gr = g.createRadialGradient(cx - r * 0.3, cy - r * 0.35, r * 0.1, cx, cy, r); gr.addColorStop(0, "#ffffff"); gr.addColorStop(0.7, "#e9e6e1"); gr.addColorStop(1, "#a9a49d");
  g.save(); g.shadowColor = "rgba(0,0,0,0.6)"; g.shadowBlur = r * 0.5; g.shadowOffsetY = r * 0.18; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fillStyle = gr; g.fill(); g.restore();
  const blink = (Math.floor(f) % 70) < 4 ? 0.12 : 1, look = Math.sin(f / 23) * r * 0.12; g.fillStyle = "#101010";
  for (const sx of [-1, 1]) { g.beginPath(); g.ellipse(cx + sx * r * 0.27 + look, cy - r * 0.08, r * 0.13, r * 0.26 * blink, 0, 0, 7); g.fill(); }
}
function sAtlas(f) {
  const s = S.atlas, drop = spring(prog(f, s.start, s.start + 20)), r = M * (TALL ? 0.1 : 0.115);
  const side = eIO(prog(f, s.start + 40, s.start + 58)), bx = TALL ? W / 2 : lerp(W / 2, W * 0.27, side), by = TALL ? lerp(H * 0.45, H * 0.2, side) : H * 0.45;
  atlasBall(bx, by - (1 - drop) * H * 0.5 + Math.sin(f / 9) * M * 0.008, r, f);
  const pt = spring(prog(f, s.start + 52, s.start + 72)), pw = (TALL ? W * 0.84 : W * 0.34) * pt;
  shot(IM["cap-atlas-3-answer"], [2127, 532, 645, 645], TALL ? W / 2 : W * 0.64, TALL ? H * 0.54 : H * 0.45, pw, { a: clamp(pt * 3) });
  if (f < s.start + 46) line("Meet [Atlas.]", f, s.start + 14, s.start + 46); else line("He proposes. [You approve.]", f, s.start + 60, s.end);
}
function sShotmap(f) {
  const s = S.shotmap, t = spring(prog(f, s.start, s.start + 18)), z = lerp(1, 1.06, prog(f, s.start, s.end));
  shot(IM["cap-shotmap-stage"], [905, 610, 1070, 800], W / 2, H * (TALL ? 0.42 : 0.44), (TALL ? W * 0.9 : M * 0.98) * t * z, { a: clamp(t * 3) });
  line("Place the camera. [Then generate.]", f, s.start + 14, s.end);
}
function sCore(f) {
  const s = S.core, t = eOut(prog(f, s.start, s.start + 30)), im = IM["cap-memory"], fx = 1336, fy = 1102, vis = lerp(520, 1500, t), sc = (TALL ? W * 1.25 : H) / vis;
  g.save(); g.globalAlpha = eOut(prog(f, s.start, s.start + 10)); const cy = H * (TALL ? 0.43 : 0.45); g.beginPath(); g.rect(0, 0, W, H); g.clip();
  const cw = Math.min(W / sc, 1500), ch = Math.min(H / sc, 1380); g.drawImage(im, fx - cw / 2, fy - ch * (cy / H), cw, ch, W / 2 - cw * sc / 2, 0, cw * sc, ch * sc); g.restore();
  const ed = g.createRadialGradient(W / 2, cy, M * 0.26, W / 2, cy, M * 0.49); ed.addColorStop(0, "rgba(6,6,6,0)"); ed.addColorStop(1, "rgba(0,0,0,1)"); g.fillStyle = ed; g.fillRect(0, 0, W, H);
  glow(W / 2, cy, M * 0.5, "rgba(255,30,20,0.5)", 0.3 + 0.2 * Math.sin(f / 8));
  line("Core remembers [your brand.]", f, s.start + 16, s.end);
}
// every card circles once, then falls into the mark
function sSwarm(f) {
  const s = S.swarm, t = prog(f, s.start, s.end), inn = eOut(prog(f, s.start, s.start + 20)), col = eIn(prog(f, TL.collapse, s.end)), cx = W / 2, cy = H / 2;
  for (let i = 0; i < CARDS; i++) { const ang = (i / CARDS) * Math.PI * 2 + t * 1.6 + col * 2.5, ring = i % 2, R = M * (ring ? 0.44 : 0.3) * (TALL ? 0.92 : 1.25) * inn * (1 - col), sz = M * (ring ? 0.15 : 0.12) * inn * (1 - col * 0.85);
    card(IM[`card-${i}`], cx + Math.cos(ang) * R * (TALL ? 1 : 1.35), cy + Math.sin(ang) * R * (TALL ? 1.5 : 0.82), sz * 0.8, sz, { rot: Math.sin(ang) * 0.12, a: clamp(inn * 2) * (1 - col * col), shadow: false }); }
  glow(cx, cy, M * 0.5 * col, "rgba(255,40,30,0.9)", col);
  if (col < 0.2) line("Everything you make. [One place.]", f, s.start + 10, TL.collapse + 4, { y: TALL ? H * 0.88 : cy, px: M * (TALL ? 0.05 : 0.044) });
}
function sEnd(f) {
  const s = S.end, t = spring(prog(f, s.start, s.start + 22)), cy = H * (TALL ? 0.4 : 0.38), lg = M * 0.3 * t;
  glow(W / 2, cy, M * 0.7, "rgba(192,7,7,0.6)", 0.5 * (1 - 0.6 * prog(f, s.start, s.start + 30)));
  const im = IM["logo"]; g.save(); g.translate(W / 2, cy); g.rotate((1 - t) * -0.6); g.globalAlpha = clamp(t * 3); g.drawImage(im, -lg / 2, -lg / 2, lg, lg); g.restore(); g.globalAlpha = 1;
  text("Eclipse Studio", W / 2, cy + M * 0.225, M * 0.062, PAPER, { w: 600, a: eOut(prog(f, s.start + 14, s.start + 28)) });
  line("Stop prompting. [Start directing.]", f, s.start + 26, s.end + 30, { y: cy + M * 0.315, px: M * 0.036 });
  text(TL.url, W / 2, H * 0.93, M * 0.02, MUTE, { a: eOut(prog(f, s.start + 44, s.start + 58)), ls: M * 0.001 });
  g.fillStyle = "#000"; g.globalAlpha = eIO(prog(f, s.end - 12, s.end - 1)); g.fillRect(0, 0, W, H); g.globalAlpha = 1;
}
const DRAW = { prompt: sPrompt, images: sImages, hits: sHits, video: sVideo, sound: sSound, one: sOne, canvas: sCanvas, atlas: sAtlas, shotmap: sShotmap, core: sCore, swarm: sSwarm, end: sEnd };
const acc = document.createElement("canvas"); acc.width = W; acc.height = H; const ag = acc.getContext("2d");
const JOIN = new Set(["images", "end"]); // these continue the scene before them, so no cut-through into them
function drawAt(n) {
  const k = TL.scenes.findIndex((s) => n >= s.start && n < s.end), sc = TL.scenes[k < 0 ? TL.scenes.length - 1 : k], next = TL.scenes[k + 1];
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = "source-over"; g.filter = "none";
  g.fillStyle = "#000"; g.fillRect(0, 0, W, H);
  const inn = JOIN.has(sc.id) || k === 0 ? 1 : eExpo(prog(n, sc.start, sc.start + 12)), out = !next || JOIN.has(next.id) ? 0 : eIn(prog(n, sc.end - 7, sc.end));
  const z = lerp(1.22, 1, inn) * (1 + 0.02 * prog(n, sc.start, sc.end)) * (1 + 0.9 * out);
  g.translate(W / 2, H / 2); g.scale(z, z); g.translate(-W / 2, -H / 2);
  if (sc.id !== "video" || n < TL.expand + 16) bg(n); DRAW[sc.id](n);
  g.setTransform(1, 0, 0, 1, 0, 0); const veil = Math.max(1 - clamp(inn * 1.6), out); if (veil > 0) { g.globalAlpha = veil; g.fillStyle = "#000"; g.fillRect(0, 0, W, H); g.globalAlpha = 1; }
}
window.renderFrame = (n, fast) => {
  const SUB = fast ? 1 : 10;
  if (SUB === 1) drawAt(n); else { for (let k = 0; k < SUB; k++) { drawAt(Math.min(n + (k / SUB) * 0.55, TL.frames - 0.01)); ag.globalAlpha = 1 / (k + 1); ag.drawImage(cv, 0, 0); } ag.globalAlpha = 1; g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = "copy"; g.drawImage(acc, 0, 0); g.globalCompositeOperation = "source-over"; }
  return cv.toDataURL("image/jpeg", 0.95).slice(23);
};
window.ready = (async () => {
  const ff = await new FontFace("Inter", "url(fonts/Inter-latin.woff2)", { weight: "100 900" }).load(); document.fonts.add(ff);
  const list = [["logo", "work/logo.png"], ["cap-memory", "work/cap-memory.png"], ["cap-atlas-3-answer", "work/cap-atlas-3-answer.png"], ["cap-shotmap-stage", "work/cap-shotmap-stage.png"], ["cap-canvas", "work/cap-canvas-1-flow.png"], ...HITS.map((n) => [`hit-${n}`, `work/hit-${n}.jpg`]),
    ...["character", "product-1", "product-2", "product-3", "product-4"].map((n) => [`cv-${n}`, `work/cv-${n}.jpg`]),
    ...Array.from({ length: CARDS }, (_, i) => [`card-${i}`, `work/card-${i}.jpg`]),
    ...Object.entries(SEQ).flatMap(([k, n]) => Array.from({ length: n }, (_, i) => { const id = `${k}-${String(i + 1).padStart(3, "0")}`; return [id, `work/seq/${id}.jpg`]; }))];
  await Promise.all(list.map(([n, src]) => new Promise((ok, no) => { const i = new Image(); i.onload = () => { IM[n] = i; ok(); }; i.onerror = () => no(new Error("missing " + src)); i.src = src; })));
  return true;
})();
