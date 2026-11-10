// The one rule that turns an original director module into the text Atlas carries (shared by the build script and its test).
export function transform(src) {
  let s = src.replace(/^---\n[\s\S]*?\n---\n/, "");
  const lines = s.split("\n").flatMap((line) => {
    if (line.startsWith("配套参考：")) return [];
    if (/\]\(\.\.\//.test(line)) {
      // a bullet that only points at another file
      if (/^- [^\[]*\[`?[^\]]*`?\]\(\.\.\/[^)]*\)[^\n]{0,40}$/.test(line) && line.length < 120) return [];
      line = line
        .replace(/[（(][^（）()]*?\[`?[^\]]*`?\]\(\.\.\/[^)]*\)[^（）()]*?[）)]/g, "")
        .replace(/[，,]?\s*(?:工具若提供[^，。]*?，)?(?:详)?见\s*\[`?[^\]]*`?\]\(\.\.\/[^)]*\)/g, "")
        .replace(/\[`?[^\]]*`?\]\(\.\.\/[^)]*\)/g, "");
    }
    return [line];
  });
  s = lines.join("\n").replace(/\[([^\]]*)\]\([^)]*\.md\)/g, "$1").replace(/\n{3,}/g, "\n\n").trim();
  return s;
}
