// Click to select: a tap picks the area around the point that looks alike (colour region growing). It is a simple, instant stand-in for a learned
// segmentation model: it works best when the shape is clear and easy to isolate. Pure, so it can be tested without a browser.
export function wandSelect(rgba: Uint8ClampedArray | Uint8Array, w: number, h: number, x: number, y: number, tolerance = 32): Uint8Array {
  const out = new Uint8Array(w * h);
  x = Math.max(0, Math.min(w - 1, Math.round(x))); y = Math.max(0, Math.min(h - 1, Math.round(y)));
  const at = (i: number) => i * 4;
  const seed = at(y * w + x);
  const sr = rgba[seed], sg = rgba[seed + 1], sb = rgba[seed + 2];
  const tol2 = tolerance * tolerance * 3;
  const near = (i: number) => { const o = at(i); const dr = rgba[o] - sr, dg = rgba[o + 1] - sg, db = rgba[o + 2] - sb; return dr * dr + dg * dg + db * db <= tol2; };
  const stack = [y * w + x];
  out[y * w + x] = 1;
  let count = 1;
  const cap = Math.floor(w * h * 0.7); // never swallow the whole picture
  while (stack.length && count < cap) {
    const i = stack.pop() as number;
    const px = i % w, py = (i - px) / w;
    for (const [nx, ny] of [[px + 1, py], [px - 1, py], [px, py + 1], [px, py - 1]]) {
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const j = ny * w + nx;
      if (!out[j] && near(j)) { out[j] = 1; count++; stack.push(j); }
    }
  }
  return out;
}
