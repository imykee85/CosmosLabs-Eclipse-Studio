// Collects every piece of interface text written in the code (JSX text, string and template literals, text-like props) into the manifest the translator is allowed to translate.
// Why a manifest: the page also shows people's own words (prompts, chats, names). Only text that is in this list is ever sent for translation, so nothing a person writes leaves their browser or is stored.
// Run `npm run i18n:extract` after changing wording; tests/unit/i18n-manifest.test.ts fails when the committed manifest is out of date.
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { hash, lift, MAX_TEXT } from "../src/lib/i18n/text.ts";

const ROOT = path.resolve(import.meta.dirname, "..", "src");
// Safety, system-prompt and server-only files: never part of the manifest.
const SKIP_FILES = /(^|\/)(moderation|prompt-engines|agent-personas|connect-agent|connect-tools|upload-scan|agent-video|video-frames|higgsfield|higgsfield-video|secret-box|safe-text|storage)\.ts$|\/providers\/|\/audio\/providers\/|\/audio\/errors\.ts$/;
const SKIP_ATTRS = new Set(["className", "id", "htmlFor", "href", "src", "type", "name", "key", "role", "style", "rel", "target", "value", "inputMode", "autoComplete", "accept", "method", "action", "fill", "stroke", "viewBox", "d", "xmlns", "transform", "data-testid", "variant", "size", "color", "loading", "decoding", "crossOrigin", "dir", "lang", "translate", "pattern", "step", "min", "max", "points", "cx", "cy", "r", "x", "y", "width", "height", "preserveAspectRatio", "aria-live", "aria-haspopup", "aria-sort", "aria-orientation", "aria-current", "aria-controls", "aria-labelledby", "aria-describedby"]);

const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ldquo: "“", rdquo: "”", lsquo: "‘", rsquo: "’", mdash: "—", ndash: "–", hellip: "…", middot: "·", times: "×", copy: "©", bull: "•" };
const decode = (s) => s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
  if (e[0] === "#") { const n = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return Number.isFinite(n) ? String.fromCodePoint(n) : m; }
  return ENT[e] ?? m;
});

// React's rule for JSX text: each line trimmed, empty lines dropped, the rest joined by one space.
function jsxText(raw) {
  const lines = raw.split(/\r\n|\n|\r/);
  const out = [];
  lines.forEach((line, i) => {
    let l = line.replace(/\t/g, " ");
    if (i !== 0) l = l.replace(/^ +/, "");
    if (i !== lines.length - 1) l = l.replace(/ +$/, "");
    if (l) out.push(l);
  });
  return decode(out.join(" "));
}

const found = new Set();
function add(text) {
  const t = text.trim();
  if (t.length < 2 || t.length > MAX_TEXT || !/\p{L}/u.test(t)) return;
  const { template } = lift(t);
  found.add(template);
}
const looksLikeText = (s) => /\p{L}{2}/u.test(s) && (/\s/.test(s.trim()) || /^\p{Lu}/u.test(s.trim()));

function visit(node) {
  if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node) || ts.isTypeNode(node) || ts.isTypeAliasDeclaration(node) || ts.isInterfaceDeclaration(node)) return;
  if (ts.isJsxText(node)) add(jsxText(node.text));
  else if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    const p = node.parent;
    const inAttr = ts.isJsxAttribute(p) || (ts.isJsxExpression(p) && ts.isJsxAttribute(p.parent));
    if (inAttr) { const attr = ts.isJsxAttribute(p) ? p : p.parent; if (!SKIP_ATTRS.has(attr.name.getText())) { const v = decode(node.text); if (looksLikeText(v)) add(v); } }
    else if (!(ts.isElementAccessExpression(p) || ts.isCaseClause(p) || (ts.isBinaryExpression(p) && [ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken].includes(p.operatorToken.kind)) || ts.isLiteralTypeNode(p))) { const v = node.text; if (looksLikeText(v)) add(v); }
  } else if (ts.isTemplateExpression(node)) {
    // Each ${...} becomes a digit, which `lift` then turns into {0}, {1}...: the same form the browser makes from rendered numbers.
    let t = node.head.text;
    for (const span of node.templateSpans) t += "0" + span.literal.text;
    if (looksLikeText(t.replace(/0/g, "x"))) add(t);
  }
  ts.forEachChild(node, visit);
}

function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(tsx?|mts)$/.test(e.name) && !/\.d\.ts$/.test(e.name) && !SKIP_FILES.test(p.replace(/\\/g, "/"))) {
      const src = fs.readFileSync(p, "utf8");
      visit(ts.createSourceFile(p, src, ts.ScriptTarget.Latest, true, p.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS));
    }
  }
}
walk(ROOT);

const list = [...found].sort();
const dir = path.join(ROOT, "lib", "i18n");
const files = { "manifest.json": JSON.stringify(list) + "\n", "manifest-hashes.json": JSON.stringify([...new Set(list.map(hash))].sort()) + "\n" };
if (process.argv.includes("--check")) {
  // Used by the unit test: fails when the committed manifest no longer matches the code.
  const stale = Object.entries(files).filter(([f, c]) => !fs.existsSync(path.join(dir, f)) || fs.readFileSync(path.join(dir, f), "utf8") !== c).map(([f]) => f);
  if (stale.length) { console.error(`i18n manifest is out of date (${stale.join(", ")}). Run: npm run i18n:extract`); process.exit(1); }
  console.log("i18n manifest is up to date");
} else {
  for (const [f, c] of Object.entries(files)) fs.writeFileSync(path.join(dir, f), c);
  console.log(`i18n manifest: ${list.length} strings`);
}
