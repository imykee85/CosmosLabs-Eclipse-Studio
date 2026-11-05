// The contact sheet: every finished variation laid out in one picture, in grid order. Pure picture work (no database), so it can be tested on its own.
// Metadata is never copied: sharp writes a clean file, so the sheet carries no EXIF or location data.
export type SheetInput = { images: Uint8Array[]; cols: number; rows: number; gap?: number; maxWidth?: number };

export async function composeSheet(o: SheetInput): Promise<{ bytes: Uint8Array; width: number; height: number; cellW: number; cellH: number }> {
  const sharp = (await import("sharp")).default;
  const gap = o.gap ?? 8;
  if (!o.images.length || o.cols < 1 || o.rows < 1 || o.images.length > o.cols * o.rows) throw new Error("Bad sheet layout");
  const first = await sharp(Buffer.from(o.images[0]), { failOn: "none", limitInputPixels: 120_000_000 }).rotate().metadata();
  const fw = first.width ?? 1024, fh = first.height ?? 1024;
  const limit = o.maxWidth ?? 4096;
  const cellW = Math.max(64, Math.min(fw, Math.floor((limit - gap * (o.cols + 1)) / o.cols)));
  const cellH = Math.max(64, Math.round((cellW * fh) / fw));
  const width = cellW * o.cols + gap * (o.cols + 1);
  const height = cellH * o.rows + gap * (o.rows + 1);
  const parts = await Promise.all(o.images.map(async (img, i) => {
    const input = await sharp(Buffer.from(img), { failOn: "none", limitInputPixels: 120_000_000 }).rotate().resize({ width: cellW, height: cellH, fit: "contain", background: "#0b0b0c" }).toBuffer();
    return { input, left: gap + (i % o.cols) * (cellW + gap), top: gap + Math.floor(i / o.cols) * (cellH + gap) };
  }));
  const out = await sharp({ create: { width, height, channels: 3, background: "#0b0b0c" } }).composite(parts).jpeg({ quality: 92 }).toBuffer();
  return { bytes: new Uint8Array(out), width, height, cellW, cellH };
}
