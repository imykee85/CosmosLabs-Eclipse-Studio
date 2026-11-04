import { claimUsage } from "@/lib/usage";

// Tells the owner when something needs attention. Posts a short line to a Slack or Discord channel webhook
// (Secret OPS_ALERT_WEBHOOK_URL). Without it nothing is sent and nothing breaks. The same alert is sent at most once an hour.
// Never carries personal data or secrets: callers pass counts and our own ids only.

const HOSTS = [/^hooks\.slack\.com$/, /^discord(app)?\.com$/];

function webhook(): URL | null {
  const raw = process.env.OPS_ALERT_WEBHOOK_URL;
  if (!raw) return null;
  try {
    const u = new URL(raw);
    return u.protocol === "https:" && HOSTS.some((h) => h.test(u.hostname)) ? u : null;
  } catch {
    return null;
  }
}

/** Never throws. Returns true when a message was posted. */
export async function opsAlert(key: string, message: string): Promise<boolean> {
  try {
    const url = webhook();
    if (!url) return false;
    if (!(await claimUsage("ops", `alert:${key}`.slice(0, 80), 1, 3600_000))) return false;
    const text = `Eclipse alert: ${message}`.slice(0, 1500);
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, content: text }), signal: AbortSignal.timeout(8000) });
    return res.ok;
  } catch (err) {
    console.error("could not send an alert", err);
    return false;
  }
}
