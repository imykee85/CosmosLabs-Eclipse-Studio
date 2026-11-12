// The Motion runtime: the page shown in a sandboxed frame (opaque origin, no network) that runs a motion's code. The parent page sends the code,
// pictures (as ImageBitmaps) and the Inter font (as bytes) with postMessage; the frame draws any moment t on demand, for the live preview or,
// at full size, for export. A motion is the BODY of `function (M) { ... return { render(g, t) { ... } } }`: pure, so the same t gives the same picture.

/** The helper library handed to a motion as `M` (also what the agent is told it may use). Kept in sync with HELP below. */
const LIB = String.raw`
var E = {
  linear: function (t) { return t; },
  inQuad: function (t) { return t * t; }, outQuad: function (t) { return 1 - (1 - t) * (1 - t); },
  inOutQuad: function (t) { return t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; },
  inCubic: function (t) { return t * t * t; }, outCubic: function (t) { return 1 - Math.pow(1 - t, 3); },
  inOutCubic: function (t) { return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; },
  inQuart: function (t) { return t * t * t * t; }, outQuart: function (t) { return 1 - Math.pow(1 - t, 4); },
  inOutQuart: function (t) { return t < .5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2; },
  inExpo: function (t) { return t === 0 ? 0 : Math.pow(2, 10 * t - 10); }, outExpo: function (t) { return t === 1 ? 1 : 1 - Math.pow(2, -10 * t); },
  inOutExpo: function (t) { return t === 0 ? 0 : t === 1 ? 1 : t < .5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2; },
  inSine: function (t) { return 1 - Math.cos(t * Math.PI / 2); }, outSine: function (t) { return Math.sin(t * Math.PI / 2); },
  inOutSine: function (t) { return -(Math.cos(Math.PI * t) - 1) / 2; },
  inBack: function (t) { var c = 1.70158; return (c + 1) * t * t * t - c * t * t; },
  outBack: function (t) { var c = 1.70158; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); },
  inOutBack: function (t) { var c = 2.5949; return t < .5 ? (Math.pow(2 * t, 2) * ((c + 1) * 2 * t - c)) / 2 : (Math.pow(2 * t - 2, 2) * ((c + 1) * (t * 2 - 2) + c) + 2) / 2; },
  outElastic: function (t) { var c = (2 * Math.PI) / 3; return t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - .75) * c) + 1; },
  outBounce: function (x) { var n = 7.5625, d = 2.75; if (x < 1 / d) return n * x * x; if (x < 2 / d) return n * (x -= 1.5 / d) * x + .75; if (x < 2.5 / d) return n * (x -= 2.25 / d) * x + .9375; return n * (x -= 2.625 / d) * x + .984375; }
};
function clamp(v, a, b) { if (a === undefined) a = 0; if (b === undefined) b = 1; return v < a ? a : v > b ? b : v; }
function lerp(a, b, k) { return a + (b - a) * k; }
function map(v, a, b, c, d, noClamp) { var k = (v - a) / (b - a || 1); if (!noClamp) k = clamp(k); return c + (d - c) * k; }
function easeOf(e) { return typeof e === "function" ? e : (E[e] || E.linear); }
function prog(t, start, end, e) { return easeOf(e)(clamp((t - start) / ((end - start) || 1e-6))); }
function hash(n) { var x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
function rand(seed, a, b) { var r = hash(seed); return a === undefined ? r : a + (b - a) * r; }
function noise(x, y) { y = y || 0; var xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  function h(i, j) { return hash(i * 57 + j * 131); } function s(t) { return t * t * (3 - 2 * t); }
  var a = h(xi, yi), b = h(xi + 1, yi), c = h(xi, yi + 1), d = h(xi + 1, yi + 1), u = s(xf), v = s(yf);
  return lerp(lerp(a, b, u), lerp(c, d, u), v); }
function hexRgb(c) { if (!c || c[0] !== "#") return [0, 0, 0]; var h = c.slice(1); if (h.length === 3) h = h.split("").map(function (x) { return x + x; }).join("");
  var n = parseInt(h.slice(0, 6), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function rgba(c, a) { var r = hexRgb(c); return "rgba(" + r[0] + "," + r[1] + "," + r[2] + "," + (a === undefined ? 1 : a) + ")"; }
function mix(c1, c2, k) { var a = hexRgb(c1), b = hexRgb(c2); return "rgb(" + Math.round(lerp(a[0], b[0], k)) + "," + Math.round(lerp(a[1], b[1], k)) + "," + Math.round(lerp(a[2], b[2], k)) + ")"; }
var FAMILY = { display: "Inter, system-ui, sans-serif", sans: "Inter, system-ui, sans-serif", serif: "Georgia, 'Times New Roman', serif", mono: "ui-monospace, Menlo, Consolas, monospace", condensed: "'Arial Narrow', 'Roboto Condensed', Inter, sans-serif" };
function fam(f) { if (!f) return FAMILY.sans; var k = String(f).toLowerCase(); return FAMILY[k] || (k === "inter" ? FAMILY.sans : FAMILY.sans); }
function font(o) { o = o || {}; return (o.italic ? "italic " : "") + (o.weight || 700) + " " + (o.size || 80) + "px " + fam(o.family); }
function apply(g, o) { g.font = font(o); g.textAlign = o.align || "left"; g.textBaseline = o.baseline || "alphabetic"; try { g.letterSpacing = (o.tracking || 0) + "px"; } catch (e) {} }
function measure(g, s, o) { o = o || {}; g.save(); apply(g, o); var w = g.measureText(String(s)).width; g.restore(); return w; }
function text(g, s, x, y, o) { o = o || {}; s = String(s); g.save(); apply(g, o);
  if (o.alpha !== undefined) g.globalAlpha *= clamp(o.alpha);
  g.translate(x, y); if (o.rotate) g.rotate(o.rotate); if (o.scale !== undefined) g.scale(o.scale, o.scale);
  if (o.stroke) { g.strokeStyle = o.stroke; g.lineWidth = o.strokeWidth || 2; g.strokeText(s, 0, 0); }
  if (o.color !== null) { g.fillStyle = o.color || "#fff"; g.fillText(s, 0, 0); }
  var w = g.measureText(s).width; g.restore(); return w; }
function letters(g, s, x, y, o, fn) { o = o || {}; s = String(s); var chars = Array.from(s), widths = [], total = 0, tr = o.tracking || 0;
  g.save(); apply(g, Object.assign({}, o, { align: "left", tracking: 0 }));
  for (var i = 0; i < chars.length; i++) { var w = g.measureText(chars[i]).width; widths.push(w); total += w + (i < chars.length - 1 ? tr : 0); }
  var start = o.align === "center" ? x - total / 2 : o.align === "right" ? x - total : x, cx = start;
  for (var j = 0; j < chars.length; j++) { var f = (fn && fn(j, chars.length, chars[j])) || {};
    g.save(); g.translate(cx + widths[j] / 2 + (f.dx || 0), y + (f.dy || 0)); if (f.rotate) g.rotate(f.rotate); var sc = f.scale === undefined ? 1 : f.scale; if (sc !== 1) g.scale(sc, sc);
    g.globalAlpha *= clamp(f.alpha === undefined ? 1 : f.alpha); g.textAlign = "center"; g.fillStyle = f.color || o.color || "#fff"; if (sc > 0.001) g.fillText(chars[j], 0, 0); g.restore();
    cx += widths[j] + tr; }
  g.restore(); return total; }
function wrap(g, s, maxW, o) { var words = String(s).split(/\s+/), lines = [], line = ""; g.save(); apply(g, o || {});
  for (var i = 0; i < words.length; i++) { var test = line ? line + " " + words[i] : words[i]; if (g.measureText(test).width > maxW && line) { lines.push(line); line = words[i]; } else line = test; }
  if (line) lines.push(line); g.restore(); return lines; }
function roundRect(g, x, y, w, h, r) { r = Math.max(0, Math.min(r || 0, Math.abs(w) / 2, Math.abs(h) / 2)); g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function image(g, i, x, y, w, h, o) { o = o || {}; var img = typeof i === "number" ? IMAGES[i] : i; if (!img) return false;
  var iw = img.width, ih = img.height, fit = o.fit || "cover", s = fit === "contain" ? Math.min(w / iw, h / ih) : Math.max(w / iw, h / ih), dw = iw * s, dh = ih * s;
  g.save(); if (o.alpha !== undefined) g.globalAlpha *= clamp(o.alpha); if (o.radius || fit === "cover") { roundRect(g, x, y, w, h, o.radius || 0); g.clip(); }
  g.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh); g.restore(); return true; }
function gradient(g, x0, y0, x1, y1, stops) { var gr = g.createLinearGradient(x0, y0, x1, y1); (stops || []).forEach(function (s) { gr.addColorStop(s[0], s[1]); }); return gr; }
function radial(g, x, y, r0, r1, stops) { var gr = g.createRadialGradient(x, y, r0, x, y, r1); (stops || []).forEach(function (s) { gr.addColorStop(s[0], s[1]); }); return gr; }
var IMAGES = [];
`;

/** What the agent is told about M (the runtime above). */
export const HELP = `M (the helper library):
- M.W, M.H: the drawing area in units. The SHORT side is always 1000 (16:9 is 1778 x 1000, 9:16 is 1000 x 1778). Draw in these units; the runtime scales to any export size.
- M.duration (seconds), M.loop (true when the end must match the start), M.fps.
- M.ease.{linear,inQuad,outQuad,inOutQuad,inCubic,outCubic,inOutCubic,inQuart,outQuart,inOutQuart,inExpo,outExpo,inOutExpo,inSine,outSine,inOutSine,inBack,outBack,inOutBack,outElastic,outBounce}
- M.prog(t, start, end, ease?) eased 0..1 between two times (ease is a name like "outExpo" or a function). M.clamp(v,a=0,b=1), M.lerp(a,b,k), M.map(v,a,b,c,d,noClamp?)
- M.rand(seed, a?, b?) deterministic random (same seed, same number). M.noise(x, y?) smooth 0..1 value noise.
- Colour: M.rgba(hex, alpha), M.mix(hex1, hex2, k). M.palette = { bg, fg, accent, colors: [...] } (from the brand kit, or a default).
- Text: M.text(g, str, x, y, {size, weight, family:"display"|"sans"|"serif"|"mono"|"condensed", color, align:"left"|"center"|"right", baseline, tracking, alpha, scale, rotate, italic, stroke, strokeWidth}) returns width.
  M.letters(g, str, x, y, opts, (i, n, ch) => ({dx, dy, alpha, scale, rotate, color})) draws letter by letter for per-glyph animation; returns total width.
  M.measure(g, str, opts) width. M.wrap(g, str, maxWidth, opts) array of lines.
- Shapes: M.roundRect(g, x, y, w, h, r) builds a path (then g.fill()/g.stroke()). M.gradient(g, x0,y0,x1,y1, [[0,"#hex"],[1,"#hex"]]), M.radial(g, x, y, r0, r1, stops).
- Pictures: M.images[i] (the attached pictures, in order; may be empty), M.imageNames[i], M.image(g, i, x, y, w, h, {fit:"cover"|"contain", radius, alpha}) returns false when missing.
- g is a normal CanvasRenderingContext2D (save/restore, translate, rotate, scale, globalAlpha, globalCompositeOperation, shadowBlur, filter, paths, arcs, beziers). The background is already painted with M.palette.bg (or your "background").`;

/** The frame's whole page. */
export const FRAME_HTML = String.raw`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>html,body{margin:0;height:100%;background:#0b0b0d;overflow:hidden}canvas{display:block;width:100%;height:100%}</style></head>
<body><canvas id="c"></canvas><script>
` + LIB + String.raw`
var comp = null, W = 1778, H = 1000, DUR = 10, FPS = 30, LOOP = false, PAL = { bg: "#0b0b0d", fg: "#ffffff", accent: "#c00707", colors: [] }, NAMES = [];
var cv = document.getElementById("c"), lastT = 0;
function M() { return { W: W, H: H, duration: DUR, fps: FPS, loop: LOOP, ease: E, clamp: clamp, lerp: lerp, map: map, prog: prog, rand: rand, noise: noise,
  rgba: rgba, mix: mix, text: text, letters: letters, measure: measure, wrap: wrap, roundRect: roundRect, image: image, gradient: gradient, radial: radial,
  images: IMAGES, imageNames: NAMES, palette: PAL, font: font }; }
function draw(g, pw, ph, t) {
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = "source-over"; g.filter = "none"; g.shadowBlur = 0; g.shadowColor = "transparent";
  g.clearRect(0, 0, pw, ph); g.setTransform(pw / W, 0, 0, ph / H, 0, 0);
  g.fillStyle = (comp && comp.background) || PAL.bg; g.fillRect(0, 0, W, H);
  if (comp && comp.render) { g.save(); comp.render(g, Math.max(0, Math.min(DUR, t))); g.restore(); }
}
function post(m, tr) { parent.postMessage(m, "*", tr || []); }
function err(e, where) { post({ type: "error", where: where, message: String(e && e.message || e).slice(0, 400), line: (String(e && e.stack || "").match(/<anonymous>:(\d+)/) || [])[1] || null }); }
function show(t) { lastT = t; var r = window.devicePixelRatio || 1, pw = Math.max(2, Math.round(cv.clientWidth * r)), ph = Math.max(2, Math.round(cv.clientHeight * r));
  if (cv.width !== pw || cv.height !== ph) { cv.width = pw; cv.height = ph; }
  try { draw(cv.getContext("2d"), pw, ph, t); } catch (e) { err(e, "render"); } }
var off = null, tmp = null;
function frame(t, w, h, blur, spf) {
  if (!off || off.width !== w || off.height !== h) { off = new OffscreenCanvas(w, h); tmp = new OffscreenCanvas(w, h); }
  var g = off.getContext("2d");
  if (!blur || blur < 2) draw(g, w, h, t);
  else { var tg = tmp.getContext("2d"); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, w, h);
    for (var k = 0; k < blur; k++) { draw(tg, w, h, t + (k / blur) * spf * 0.5); g.globalAlpha = 1 / (k + 1); g.drawImage(tmp, 0, 0); } g.globalAlpha = 1; }
  return off.transferToImageBitmap();
}
addEventListener("resize", function () { show(lastT); });
addEventListener("message", function (ev) { var m = ev.data || {};
  if (m.type === "font" && m.bytes) { try { var f = new FontFace("Inter", m.bytes, { weight: "100 900" }); f.load().then(function (ff) { document.fonts.add(ff); show(lastT); post({ type: "font" }); }); } catch (e) {} return; }
  if (m.type === "load") {
    W = m.W; H = m.H; DUR = m.duration; FPS = m.fps || 30; LOOP = !!m.loop; if (m.palette) PAL = m.palette; IMAGES.length = 0; (m.images || []).forEach(function (b) { IMAGES.push(b); }); NAMES = m.names || [];
    comp = null;
    try { var fn = new Function("M", m.code); comp = fn(M()); if (!comp || typeof comp.render !== "function") throw new Error("The motion did not return { render(g, t) }."); }
    catch (e) { comp = null; err(e, "compile"); show(0); return; }
    show(m.t || 0); post({ type: "ready" }); return; }
  if (m.type === "seek") { show(m.t || 0); return; }
  if (m.type === "frame") { try { var bmp = frame(m.t, m.w, m.h, m.blur || 0, 1 / (m.fps || FPS)); post({ type: "frame", id: m.id, bitmap: bmp }, [bmp]); } catch (e) { err(e, "render"); post({ type: "frame", id: m.id, error: String(e && e.message || e) }); } return; }
});
post({ type: "hello" });
</script></body></html>`;

/** The frame's security rules: an opaque origin, no network, only Eclipse may show it. `unsafe-eval` runs the motion's code inside this jail only. */
export const FRAME_CSP = [
  "sandbox allow-scripts",
  "default-src 'none'",
  "script-src 'unsafe-inline' 'unsafe-eval'",
  "style-src 'unsafe-inline'",
  "img-src data: blob:",
  "font-src data: blob:",
  "connect-src 'none'",
  "frame-ancestors 'self'",
].join("; ");
