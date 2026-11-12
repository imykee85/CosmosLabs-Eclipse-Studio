// A plain email to the owner, for alerts (new sign-ups, things that need attention). Sent through Resend's HTTP API.
// Settings: RESEND_API_KEY (Secret), ALERT_EMAIL (Config value: where it goes), optional ALERT_EMAIL_FROM (Config value; the default
// "Eclipse <onboarding@resend.dev>" only delivers to the address the Resend account was made with, so use your own verified domain to send elsewhere).
// Without the key or the address nothing is sent and nothing breaks. Never throws.

export const emailConfigured = (): boolean => Boolean(process.env.RESEND_API_KEY && ownerAddress());

function ownerAddress(): string | null {
  const a = (process.env.ALERT_EMAIL ?? "").trim();
  return /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(a) ? a : null;
}

export async function emailOwner(subject: string, text: string): Promise<boolean> {
  try {
    const key = process.env.RESEND_API_KEY, to = ownerAddress();
    if (!key || !to) return false;
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: process.env.ALERT_EMAIL_FROM || "Eclipse <onboarding@resend.dev>", to: [to], subject: subject.slice(0, 200), text: text.slice(0, 5000) }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) console.error("alert email refused", res.status);
    return res.ok;
  } catch (err) {
    console.error("could not send an alert email", err);
    return false;
  }
}
