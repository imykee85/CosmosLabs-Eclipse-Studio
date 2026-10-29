// Where sign-in may send a person back to afterwards. Only the Eclipse connection page, with its own parameters: a "next" address is never followed anywhere else (no open redirect).
export function safeNext(v: string | null | undefined): string | null {
  if (typeof v !== "string" || v.length > 2000 || /[\r\n\\]/.test(v)) return null;
  return v.startsWith("/oauth/authorize?") ? v : null;
}
