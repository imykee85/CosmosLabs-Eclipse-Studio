import { directConnectors } from "@/lib/connectors";

// Real delivery to the apps that connect directly. Only fixed, known hosts are ever called, whatever a user pastes in.
export class SendError extends Error {}

type Link = { token: string; chatId?: string };

export function checkFields(connector: string, values: Record<string, unknown>): Link {
  const spec = directConnectors[connector];
  if (!spec) throw new SendError("That app cannot be connected with a pasted credential.");
  const v = (k: string) => (typeof values[k] === "string" ? (values[k] as string).trim() : "");
  const token = v("token");
  if (connector === "telegram") {
    if (!/^\d{5,}:[\w-]{20,}$/.test(token)) throw new SendError("That does not look like a Telegram bot token.");
    const chatId = v("chatId");
    if (!/^(-?\d{3,20}|@[A-Za-z][\w]{3,})$/.test(chatId)) throw new SendError("Enter the chat id as a number, or a channel name starting with @.");
    return { token, chatId };
  }
  if (connector === "slack") {
    let u: URL;
    try { u = new URL(token); } catch { throw new SendError("That is not a web address."); }
    if (u.protocol !== "https:" || u.hostname !== "hooks.slack.com" || !u.pathname.startsWith("/services/")) throw new SendError("Paste the Incoming Webhook address from Slack (it starts with https://hooks.slack.com/services/).");
    return { token };
  }
  throw new SendError("Unsupported app.");
}

async function post(url: string, body: unknown): Promise<{ ok: boolean; status: number; text: string }> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(15000) });
  return { ok: res.ok, status: res.status, text: await res.text().catch(() => "") };
}

/** Sends a message (and optionally a picture by address) and returns a short label for the destination. */
export async function sendTo(connector: string, link: Link, text: string, imageUrl?: string): Promise<string> {
  if (connector === "telegram") {
    const base = `https://api.telegram.org/bot${link.token}`;
    const r = imageUrl
      ? await post(`${base}/sendPhoto`, { chat_id: link.chatId, photo: imageUrl, caption: text.slice(0, 1000) })
      : await post(`${base}/sendMessage`, { chat_id: link.chatId, text: text.slice(0, 4000) });
    if (!r.ok) throw new SendError(`Telegram refused it (${r.status}): ${telegramReason(r.text)}`);
    return `Telegram chat ${link.chatId}`;
  }
  if (connector === "slack") {
    const blocks: unknown[] = [{ type: "section", text: { type: "mrkdwn", text: text.slice(0, 2900) || " " } }];
    if (imageUrl) blocks.push({ type: "image", image_url: imageUrl, alt_text: "Eclipse render" });
    const r = await post(link.token, { text: text.slice(0, 2900) || "Eclipse", blocks });
    if (!r.ok) throw new SendError(`Slack refused it (${r.status}): ${r.text.slice(0, 120)}`);
    return "Slack channel";
  }
  throw new SendError("Unsupported app.");
}

function telegramReason(text: string): string {
  try { return JSON.parse(text).description ?? text.slice(0, 120); } catch { return text.slice(0, 120); }
}
