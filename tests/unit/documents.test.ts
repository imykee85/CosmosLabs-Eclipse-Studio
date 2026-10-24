import { test } from "node:test";
import assert from "node:assert/strict";
import { documentBlocks, documentText, parseDocuments } from "../../src/lib/documents";

test("documents: text and PDFs are kept, empty or unnamed ones are dropped, at most four", () => {
  const docs = parseDocuments([
    { name: "brief.md", text: "Hello" },
    { name: "deck.pdf", pdf: "JVBERi0=" },
    { name: "", text: "no name" },
    { name: "empty.txt" },
    { name: "a.txt", text: "1" }, { name: "b.txt", text: "2" }, { name: "c.txt", text: "3" },
  ]);
  assert.deepEqual(docs.map((d) => d.name), ["brief.md", "deck.pdf", "a.txt", "b.txt"]);
  assert.equal(parseDocuments("nope").length, 0);
});

test("documents: text goes into the message, PDFs go as document blocks", () => {
  const docs = parseDocuments([{ name: "brief.md", text: "Hello" }, { name: "deck.pdf", pdf: "JVBERi0=" }]);
  assert.equal(documentText(docs), "\n\n[Attached file: brief.md]\nHello");
  const blocks = documentBlocks(docs);
  assert.equal(blocks.length, 1);
  assert.deepEqual(blocks[0], { type: "document", source: { type: "base64", media_type: "application/pdf", data: "JVBERi0=" }, title: "deck.pdf" });
});

test("documents: an oversized PDF is refused, not passed on", () => {
  const huge = "A".repeat(4_300_000);
  assert.equal(parseDocuments([{ name: "big.pdf", pdf: huge }]).length, 0);
});
