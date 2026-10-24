// Every + button takes any file. A file is sorted by its name and type into a picture, a video or a document; pictures and videos go to storage
// (see use-uploads.ts), documents go to the chat as an attachment and are kept with that chat only.
const PICTURE = /\.(png|jpe?g|webp|gif|heic|heif|avif|bmp|tiff?|svg|ico|jxl)$/i;
const VIDEO = /\.(mp4|m4v|mov|webm|mkv|avi|3gp|mpe?g|wmv|flv|ts|mts|m2ts)$/i;
const DOCX = /\.docx$/i;
const PDF = /\.pdf$/i;
const MAX_TEXT = 60_000;     // characters of a document sent with one message
const MAX_PDF = 3_000_000;   // bytes; the host rejects request bodies over about 4.5 MB

export type AttachKind = "picture" | "video" | "document";
export function attachKind(f: File): AttachKind {
  if (f.type.startsWith("image/") || PICTURE.test(f.name)) return "picture";
  if (f.type.startsWith("video/") || VIDEO.test(f.name)) return "video";
  return "document";
}

export type DocumentRead =
  | { ok: true; name: string; text?: string; pdf?: string }
  | { ok: false; name: string; error: string };

function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

// Reads a document in the browser: PDF (sent as a file), Word (.docx, text only), and any file that is plain text (txt, md, csv, json, code, html...).
// Anything else (old Word, Excel, PowerPoint, RTF, archives) cannot be read yet and is reported by name.
export async function readDocument(f: File): Promise<DocumentRead> {
  const name = f.name.slice(0, 120);
  if (PDF.test(f.name) || f.type === "application/pdf") {
    if (f.size > MAX_PDF) return { ok: false, name, error: "PDFs up to 3 MB can be read in a message." };
    return { ok: true, name, pdf: toBase64(await f.arrayBuffer()) };
  }
  if (DOCX.test(f.name)) {
    if (f.size > 10_000_000) return { ok: false, name, error: "Word files up to 10 MB can be read." };
    const mammoth = await import("mammoth");
    const r = await mammoth.extractRawText({ arrayBuffer: await f.arrayBuffer() });
    return { ok: true, name, text: r.value.slice(0, MAX_TEXT) };
  }
  const buf = await f.arrayBuffer();
  const view = new Uint8Array(buf, 0, Math.min(buf.byteLength, 8000));
  if (view.includes(0)) return { ok: false, name, error: "This kind of file cannot be read yet. It is attached by name only." };
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(buf);
    return { ok: true, name, text: text.slice(0, MAX_TEXT) };
  } catch {
    return { ok: false, name, error: "This kind of file cannot be read yet. It is attached by name only." };
  }
}
