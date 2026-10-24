import type Anthropic from "@anthropic-ai/sdk";

// Documents a person attaches to a chat message (see attach-file.ts). Text is put into the message as text, a PDF goes to the model as a document.
// Only the message that carries them has the file; a chat that is deleted takes them with it.
export type DocumentIn = { name: string; text?: string; pdf?: string };
const MAX_DOCS = 4;
const MAX_TEXT = 60_000;
const MAX_PDF_CHARS = 4_200_000; // about 3 MB of PDF in base64

export function parseDocuments(v: unknown): DocumentIn[] {
  if (!Array.isArray(v)) return [];
  const out: DocumentIn[] = [];
  for (const d of v) {
    if (out.length >= MAX_DOCS) break;
    if (!d || typeof d !== "object") continue;
    const o = d as Record<string, unknown>;
    const name = typeof o.name === "string" ? o.name.slice(0, 120) : "";
    if (!name) continue;
    const text = typeof o.text === "string" ? o.text.slice(0, MAX_TEXT) : undefined;
    const pdf = typeof o.pdf === "string" && o.pdf.length <= MAX_PDF_CHARS ? o.pdf : undefined;
    if (text === undefined && pdf === undefined) continue;
    out.push({ name, text, pdf });
  }
  return out;
}

// The text part that goes in front of the person's words, and the PDF blocks that go before them.
export function documentText(docs: DocumentIn[]): string {
  return docs.filter((d) => d.text !== undefined).map((d) => `\n\n[Attached file: ${d.name}]\n${d.text}`).join("");
}
export function documentBlocks(docs: DocumentIn[]): Anthropic.ContentBlockParam[] {
  return docs.filter((d) => d.pdf !== undefined).map((d) => ({ type: "document" as const, source: { type: "base64" as const, media_type: "application/pdf" as const, data: d.pdf! }, title: d.name }));
}
