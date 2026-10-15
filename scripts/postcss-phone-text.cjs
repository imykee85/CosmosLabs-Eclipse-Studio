// PostCSS plugin for the landing page only (src/app/landing.css). Owner 2026-10-15: on phones every text on the homepage is twice as big,
// with the same layout; the hero title keeps its size. A phone draws the landing page about 780 to 924 px wide on a 390 pt screen, so text there is
// half size. For every rule that sets a font size, a copy is added right after it (same @media) with `html[data-phone]` in front of each selector and
// the size doubled; `data-phone` is set on <html> by PHONE_LAYOUT_SCRIPT in src/app/layout.tsx on the landing page of a portrait phone only.
// Keeping each copy next to its original keeps the cascade order the same, so media-query overrides still win where they did.
const SKIP_SELECTOR = /hero h1|^\s*(html|body|:root)\b|login|auth-|ob-/;
const SIZE = /(clamp\([^()]*(?:\([^()]*\)[^()]*)*\)|min\([^()]*\)|max\([^()]*\)|calc\([^()]*\)|\d*\.?\d+px)/;

const double = (v) => `calc(${v} * 2)`;

function phoneValue(prop, value) {
  if (prop === "font-size") {
    if (!SIZE.test(value) || /^\s*0(px)?\s*$/.test(value)) return null;
    return double(value.trim());
  }
  // font shorthand: double the size part (the first length after the optional style/weight), keep the line height and family
  const m = value.match(SIZE);
  if (!m) return null;
  return value.replace(SIZE, double(m[0]));
}

module.exports = () => ({
  postcssPlugin: "phone-text",
  Once(root, { result }) {
    const file = (root.source && root.source.input && root.source.input.file) || result.opts.from || "";
    if (!/[\\/]app[\\/]landing\.css$/.test(file)) return;
    root.walkRules((rule) => {
      if (rule.selector.includes("html[data-phone]")) return;
      if (rule.parent && rule.parent.type === "atrule" && /keyframes/i.test(rule.parent.name)) return;
      const decls = [];
      rule.each((d) => {
        if (d.type !== "decl" || (d.prop !== "font-size" && d.prop !== "font")) return;
        const v = phoneValue(d.prop, d.value);
        if (v) decls.push(d.clone({ value: v }));
      });
      if (!decls.length) return;
      const sels = rule.selectors.filter((s) => !SKIP_SELECTOR.test(s)).map((s) => `html[data-phone] ${s.trim()}`);
      if (!sels.length) return;
      const copy = rule.clone({ selectors: sels, nodes: [] });
      decls.forEach((d) => copy.append(d));
      rule.after(copy);
    });
  },
});
module.exports.postcss = true;
