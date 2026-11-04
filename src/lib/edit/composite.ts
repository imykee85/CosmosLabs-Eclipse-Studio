// Retouch compositing: after the model answers, ONLY the selected area (grown a few pixels and feathered at its edge) is pasted back onto the original,
// so everything outside the selection stays pixel-identical and the picture keeps its size. Pure picture work, tested on its own.
export type CompositeInput = { original: Uint8Array; result: Uint8Array; mask: Uint8Array; dilate?: number; feather?: number };

export async function composeRetouch(o: CompositeInput): Promise<{ bytes: Uint8Array; width: number; height: number }> {
  const sharp = (await import("sharp")).default;
  const base = sharp(Buffer.from(o.original), { failOn: "none", limitInputPixels: 120_000_000 }).rotate();
  const meta = await base.clone().metadata();
  const flip = (meta.orientation ?? 1) >= 5;
  const w = flip ? meta.height ?? 0 : meta.width ?? 0, h = flip ? meta.width ?? 0 : meta.height ?? 0;
  if (!w || !h) throw new Error("Could not read the picture");
  const grow = Math.max(0, o.dilate ?? Math.round(Math.max(w, h) / 500)); // a few pixels so the edit reaches past the selection's edge
  const soft = Math.max(0.3, o.feather ?? Math.max(w, h) / 400);
  // the mask at the picture's size: white where the person selected (any non-transparent pixel counts), then grown and softened
  const raw = await sharp(Buffer.from(o.mask), { failOn: "none" }).ensureAlpha().extractChannel(3).resize(w, h, { fit: "fill", kernel: "linear" }).raw().toBuffer();
  let m = sharp(raw, { raw: { width: w, height: h, channels: 1 } });
  if (grow > 0) m = sharp(await m.blur(grow + 0.3).threshold(24).extractChannel(0).raw().toBuffer(), { raw: { width: w, height: h, channels: 1 } });
  const alpha = await m.blur(soft).extractChannel(0).raw().toBuffer();
  const originalPng = await base.clone().removeAlpha().png().toBuffer();
  const resultRgb = await sharp(Buffer.from(o.result), { failOn: "none" }).rotate().resize(w, h, { fit: "fill" }).removeAlpha().raw().toBuffer();
  const patch = await sharp(resultRgb, { raw: { width: w, height: h, channels: 3 } }).joinChannel(alpha, { raw: { width: w, height: h, channels: 1 } }).png().toBuffer();
  const out = await sharp(originalPng).composite([{ input: patch }]).png().toBuffer(); // PNG: lossless, so outside the mask nothing changes
  return { bytes: new Uint8Array(out), width: w, height: h };
}
