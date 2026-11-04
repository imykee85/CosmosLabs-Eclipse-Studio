// Click to select: a tap picks the object or area under the point. A smart colour-region grower, instant and offline (no model, nothing leaves the browser):
//  - it follows a gradient (a sky, skin, a lit wall) because each step is compared with the pixel it came from AND with the region's running average,
//  - it stops at strong edges (an outline between two things) because a sharp-edge map blocks the growth,
//  - it then fills small holes inside the shape (a highlight, an eye, a button) and smooths the outline, so the selection is one clean piece.
// Pure, so it can be tested without a browser.
export function wandSelect(rgba: Uint8ClampedArray | Uint8Array, w: number, h: number, x: number, y: number, tolerance = 32): Uint8Array {
  const n = w * h;
  x = Math.max(0, Math.min(w - 1, Math.round(x))); y = Math.max(0, Math.min(h - 1, Math.round(y)));
  // luminance and its edge strength (Sobel)
  const lum = new Float32Array(n);
  for (let i = 0; i < n; i++) { const o = i * 4; lum[i] = 0.299 * rgba[o] + 0.587 * rgba[o + 1] + 0.114 * rgba[o + 2]; }
  const edge = new Float32Array(n);
  for (let py = 1; py < h - 1; py++) for (let px = 1; px < w - 1; px++) {
    const i = py * w + px;
    const gx = -lum[i - w - 1] - 2 * lum[i - 1] - lum[i + w - 1] + lum[i - w + 1] + 2 * lum[i + 1] + lum[i + w + 1];
    const gy = -lum[i - w - 1] - 2 * lum[i - w] - lum[i - w + 1] + lum[i + w - 1] + 2 * lum[i + w] + lum[i + w + 1];
    edge[i] = Math.sqrt(gx * gx + gy * gy) / 4;
  }
  const edgeLimit = 18 + tolerance * 0.9; // a step in brightness bigger than this (per pixel) is an outline
  const dist2 = (a: number, b: number) => { const oa = a * 4, ob = b * 4; const dr = rgba[oa] - rgba[ob], dg = rgba[oa + 1] - rgba[ob + 1], db = rgba[oa + 2] - rgba[ob + 2]; return dr * dr + dg * dg + db * db; };
  const seedTol2 = (tolerance * 1.8) ** 2 * 3;    // how far from the clicked colour the region may drift in all
  const stepTol2 = (tolerance * 0.55) ** 2 * 3;   // how big one step to the next pixel may be (allows gradients, not edges)
  const out = new Uint8Array(n);
  const seed = y * w + x;
  out[seed] = 1;
  const stack = [seed];
  let count = 1, sr = rgba[seed * 4], sg = rgba[seed * 4 + 1], sb = rgba[seed * 4 + 2]; // running mean of the region
  const cap = Math.floor(n * 0.7); // never swallow the whole picture
  const meanTol2 = (tolerance * 1.2) ** 2 * 3;
  while (stack.length && count < cap) {
    const i = stack.pop() as number;
    const px = i % w, py = (i - px) / w;
    const nb = [px + 1 < w ? i + 1 : -1, px > 0 ? i - 1 : -1, py + 1 < h ? i + w : -1, py > 0 ? i - w : -1];
    for (const j of nb) {
      if (j < 0 || out[j]) continue;
      if (edge[j] > edgeLimit && j !== seed) continue;
      const o = j * 4;
      const dm = (rgba[o] - sr) ** 2 + (rgba[o + 1] - sg) ** 2 + (rgba[o + 2] - sb) ** 2;
      if (dm > meanTol2 || dist2(j, seed) > seedTol2 || dist2(j, i) > stepTol2) continue;
      out[j] = 1; count++; stack.push(j);
      sr += (rgba[o] - sr) / count; sg += (rgba[o + 1] - sg) / count; sb += (rgba[o + 2] - sb) / count;
    }
  }
  fillHoles(out, w, h, Math.max(8, Math.floor(count * 0.08)));
  smooth(out, w, h);
  return out;
}

// Unselected islands completely surrounded by the selection (and not bigger than `max` pixels) join it.
function fillHoles(m: Uint8Array, w: number, h: number, max: number) {
  const n = w * h, seen = new Uint8Array(n);
  for (let s = 0; s < n; s++) {
    if (m[s] || seen[s]) continue;
    const comp = [s]; seen[s] = 1;
    let touchesBorder = false;
    for (let k = 0; k < comp.length; k++) {
      const i = comp[k], px = i % w, py = (i - px) / w;
      if (px === 0 || py === 0 || px === w - 1 || py === h - 1) touchesBorder = true;
      for (const j of [px + 1 < w ? i + 1 : -1, px > 0 ? i - 1 : -1, py + 1 < h ? i + w : -1, py > 0 ? i - w : -1]) if (j >= 0 && !m[j] && !seen[j]) { seen[j] = 1; comp.push(j); }
    }
    if (!touchesBorder && comp.length <= max) for (const i of comp) m[i] = 1;
  }
}

// One close (grow then shrink by a pixel) joins hairline gaps; one open (shrink then grow) drops specks and stray spurs.
function smooth(m: Uint8Array, w: number, h: number) {
  const step = (src: Uint8Array, grow: boolean) => {
    const out = new Uint8Array(src.length);
    for (let py = 0; py < h; py++) for (let px = 0; px < w; px++) {
      let any = 0, all = 1;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = px + dx, ny = py + dy;
        const v = nx < 0 || ny < 0 || nx >= w || ny >= h ? (grow ? 0 : 1) : src[ny * w + nx];
        if (v) any = 1; else all = 0;
      }
      out[py * w + px] = grow ? any : all;
    }
    return out;
  };
  const closed = step(step(m, true), false);
  const opened = step(step(closed, false), true);
  for (let i = 0; i < m.length; i++) m[i] = opened[i] || m[i] && closed[i] ? 1 : 0;
}
