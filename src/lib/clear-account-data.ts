// What the browser keeps for the person who was signed in (chats, drafts, saved templates, last balance) is cleared at sign-out, so the next person
// to sign in on the same browser does not see it. Interface choices (theme, views) and canvases (they sync to the account) are left alone.
const PREFIXES = ["eclipse-agent-chat-", "eclipse-agent-history-", "eclipse-prompts-", "eclipse-draft-"];
const KEYS = ["eclipse-portfolio", "eclipse-canvas-templates", "eclipse-credits", "eclipse-custom-agents", "eclipse-agent"];

export function clearAccountData(): void {
  try {
    const drop: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (KEYS.includes(k) || PREFIXES.some((p) => k.startsWith(p)))) drop.push(k);
    }
    drop.forEach((k) => localStorage.removeItem(k));
  } catch {}
}
