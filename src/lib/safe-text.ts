// Text from a provider is shown to people, so it is cleaned first: anything that looks like a key, token or header value is hidden, web addresses lose their
// query strings, and it is cut short. The full original text stays in the server logs only.
export function safeText(input: unknown, max = 220): string {
  if (typeof input !== "string") return "";
  return input
    .replace(/\b(Bearer|Key|Basic|Token)\s+[A-Za-z0-9._~+/=-]{6,}/gi, "$1 [hidden]")
    .replace(/(https?:\/\/[^\s"'<>?#]+)[?#][^\s"'<>]*/gi, "$1")
    .replace(/\b(?:sk|pk|rk|ak|AIza|ark|hf|key)[-_]?[A-Za-z0-9_-]{16,}\b/g, "[hidden]")
    .replace(/[A-Za-z0-9_-]{32,}/g, "[hidden]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}
