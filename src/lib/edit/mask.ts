// Retouch with a real mask: the person's selection (a picture with colour where they painted, transparent elsewhere) becomes the mask OpenAI's picture
// editor expects: a PNG the same size as the picture, FULLY TRANSPARENT where it may change and opaque everywhere else. Pure picture work.
export async function openaiMask(selection: Uint8Array, picture: Uint8Array): Promise<Uint8Array> {
  const sharp = (await import("sharp")).default;
  const meta = await sharp(Buffer.from(picture), { failOn: "none", limitInputPixels: 120_000_000 }).rotate().metadata();
  const flip = (meta.orientation ?? 1) >= 5;
  const w = flip ? meta.height ?? 0 : meta.width ?? 0, h = flip ? meta.width ?? 0 : meta.height ?? 0;
  if (!w || !h) throw new Error("Could not read the picture");
  const alpha = await sharp(Buffer.from(selection), { failOn: "none" }).ensureAlpha().extractChannel(3).resize(w, h, { fit: "fill", kernel: "linear" }).raw().toBuffer();
  const inverted = Buffer.alloc(w * h);
  for (let i = 0; i < inverted.length; i++) inverted[i] = alpha[i] > 40 ? 0 : 255; // selected: transparent (edit here); the rest: opaque (keep)
  const out = await sharp({ create: { width: w, height: h, channels: 3, background: { r: 255, g: 255, b: 255 } } })
    .joinChannel(inverted, { raw: { width: w, height: h, channels: 1 } }).png().toBuffer();
  return new Uint8Array(out);
}
