import { directConnectors } from "@/lib/connectors";

// Real delivery to the apps that connect with a pasted credential (no app registered with the service). Only fixed, known hosts are
// ever called, whatever a user pastes in: every address is built here from the service's own host, never taken from the user, except
// the webhook addresses, which must be on that service's webhook host (Slack, Discord).
export class SendError extends Error {}

export type Link = Record<string, string>;
export type Attachment = { url: string; bytes?: Uint8Array; type?: string; name?: string; link7?: string }; // link7: a 7-day share link for apps that keep the address

const v = (values: Record<string, unknown>, k: string) => (typeof values[k] === "string" ? (values[k] as string).trim() : "");
const need = (ok: boolean, msg: string) => { if (!ok) throw new SendError(msg); };
const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
const isPhone = (s: string) => /^\+[1-9]\d{6,14}$/.test(s);

export function checkFields(connector: string, values: Record<string, unknown>): Link {
  const spec = directConnectors[connector];
  if (!spec) throw new SendError("That app cannot be connected with a pasted credential.");
  const out: Link = {};
  for (const f of spec.fields) out[f.key] = v(values, f.key);
  const t = out.token ?? "";
  switch (connector) {
    case "telegram":
      need(/^\d{5,}:[\w-]{20,}$/.test(t), "That does not look like a Telegram bot token.");
      need(/^(-?\d{3,20}|@[A-Za-z][\w]{3,})$/.test(out.chatId), "Enter the chat id as a number, or a channel name starting with @.");
      return out;
    case "slack": {
      let u: URL | null = null; try { u = new URL(t); } catch {}
      need(!!u && u.protocol === "https:" && u.hostname === "hooks.slack.com" && u.pathname.startsWith("/services/"), "Paste the Incoming Webhook address from Slack (it starts with https://hooks.slack.com/services/).");
      return out;
    }
    case "discord": {
      let u: URL | null = null; try { u = new URL(t); } catch {}
      need(!!u && u.protocol === "https:" && ["discord.com", "discordapp.com", "canary.discord.com", "ptb.discord.com"].includes(u.hostname) && /^\/api\/webhooks\/\d+\/[\w-]+\/?$/.test(u.pathname), "Paste the webhook address from Discord (Server Settings, Integrations, Webhooks; it starts with https://discord.com/api/webhooks/).");
      return out;
    }
    case "twilio":
      need(/^AC[0-9a-f]{32}$/i.test(out.sid), "The Account SID starts with AC and has 34 characters.");
      need(/^[0-9a-f]{32}$/i.test(t), "The Auth Token has 32 characters.");
      need(isPhone(out.from) || /^MG[0-9a-f]{32}$/i.test(out.from), "Enter the Twilio number you send from as +15551234567 (or a Messaging Service SID starting with MG).");
      need(isPhone(out.to), "Enter the number to send to as +15551234567.");
      return out;
    case "sendgrid":
      need(/^SG\.[\w-]{16,}\.[\w-]{16,}$/.test(t), "A SendGrid API key starts with SG. and has two parts.");
      need(isEmail(out.from), "Enter the sender address you verified in SendGrid.");
      need(isEmail(out.to), "Enter the address to send to.");
      return out;
    case "whatsapp-business":
      need(t.length >= 20 && /^[\w-]+$/.test(t), "Paste the access token from your WhatsApp Business app (Meta for Developers).");
      need(/^\d{6,20}$/.test(out.phoneId), "The phone number ID is the long number shown next to your WhatsApp number in Meta for Developers.");
      need(isPhone(out.to), "Enter the number to send to as +15551234567.");
      return out;
    case "notion":
      need(/^(secret_|ntn_)[\w]{20,}$/.test(t), "Paste the Internal Integration Secret from notion.so/my-integrations (it starts with ntn_ or secret_).");
      out.pageId = (out.pageId.match(/[0-9a-f]{32}|[0-9a-f-]{36}/i)?.[0] ?? "").replace(/-/g, "");
      need(out.pageId.length === 32, "Paste the address of the Notion page to add to (share it with your integration first).");
      return out;
    case "linear":
      need(/^lin_api_[\w]{20,}$/.test(t), "Paste a Linear personal API key (it starts with lin_api_).");
      need(!out.team || /^[A-Za-z][A-Za-z0-9]{0,9}$/.test(out.team), "The team key is the short code before issue numbers, for example ENG.");
      return out;
    case "todoist":
      need(/^[0-9a-f]{40}$/i.test(t), "Paste your Todoist API token (Settings, Integrations, Developer).");
      return out;
    case "github":
      need(/^(ghp_|github_pat_)[\w]{20,}$/.test(t), "Paste a GitHub personal access token (it starts with ghp_ or github_pat_) that can write issues.");
      need(/^[A-Za-z0-9-]{1,39}\/[A-Za-z0-9._-]{1,100}$/.test(out.repo) && !out.repo.split("/").some((p) => p === "." || p === ".."), "Enter the repository as owner/name.");
      return out;
    case "jira":
      out.site = out.site.replace(/^https?:\/\//, "").replace(/\/.*$/, "").toLowerCase();
      need(/^[a-z0-9][a-z0-9-]*\.atlassian\.net$/.test(out.site), "Enter your Jira site, for example yourteam.atlassian.net.");
      need(isEmail(out.email), "Enter the email address of your Atlassian account.");
      need(t.length >= 20, "Paste an API token from id.atlassian.com (Security, API tokens).");
      need(/^[A-Z][A-Z0-9_]{1,9}$/.test(out.project.toUpperCase()), "Enter the project key, for example CREA.");
      out.project = out.project.toUpperCase();
      return out;
  }
  throw new SendError("Unsupported app.");
}

async function call(url: string, init: RequestInit): Promise<{ ok: boolean; status: number; text: string }> {
  try {
    const res = await fetch(url, { ...init, redirect: "error", signal: AbortSignal.timeout(20000) });
    return { ok: res.ok, status: res.status, text: await res.text().catch(() => "") };
  } catch { throw new SendError("The service could not be reached. Please try again."); }
}
const json = (body: unknown, headers: Record<string, string> = {}): RequestInit => ({ method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });
const reason = (t: string) => { try { const j = JSON.parse(t); return String(j.description ?? j.message ?? j.error?.message ?? j.errors?.[0]?.message ?? j.errorMessages?.[0] ?? t).slice(0, 160); } catch { return t.slice(0, 160); } };
const fail = (app: string, r: { status: number; text: string }): never => { throw new SendError(`${app} refused it (${r.status}): ${reason(r.text)}`); };
const basic = (a: string, b: string) => `Basic ${Buffer.from(`${a}:${b}`).toString("base64")}`;

/** Checks a credential without posting anything (the apps where a test message would create real tasks or issues). Returns the label shown for the link. */
export async function verify(connector: string, link: Link): Promise<string | null> {
  switch (connector) {
    case "notion": {
      const r = await call(`https://api.notion.com/v1/pages/${link.pageId}`, { headers: { Authorization: `Bearer ${link.token}`, "Notion-Version": "2022-06-28" } });
      if (!r.ok) fail("Notion", r);
      return "Notion page";
    }
    case "linear": {
      const r = await call("https://api.linear.app/graphql", json({ query: "{ teams(first: 50) { nodes { id key name } } }" }, { Authorization: link.token }));
      if (!r.ok) fail("Linear", r);
      const teams = (JSON.parse(r.text)?.data?.teams?.nodes ?? []) as { id: string; key: string; name: string }[];
      const team = link.team ? teams.find((x) => x.key.toLowerCase() === link.team.toLowerCase()) : teams[0];
      if (!team) throw new SendError(link.team ? `No Linear team with the key ${link.team}.` : "That Linear account has no teams.");
      link.teamId = team.id;
      return `Linear team ${team.name}`;
    }
    case "todoist": {
      const r = await call("https://api.todoist.com/api/v1/projects", { headers: { Authorization: `Bearer ${link.token}` } });
      if (!r.ok) fail("Todoist", r);
      return "Todoist inbox";
    }
    case "github": {
      const r = await call(`https://api.github.com/repos/${link.repo}`, { headers: { Authorization: `Bearer ${link.token}`, Accept: "application/vnd.github+json", "User-Agent": "EclipseStudio" } });
      if (!r.ok) fail("GitHub", r);
      return `GitHub ${link.repo}`;
    }
    case "jira": {
      const r = await call(`https://${link.site}/rest/api/3/project/${link.project}`, { headers: { Authorization: basic(link.email, link.token), Accept: "application/json" } });
      if (!r.ok) fail("Jira", r);
      return `Jira ${link.project}`;
    }
  }
  return null; // the others prove themselves with a test message
}

/** Sends a message (and optionally one finished picture) and returns a short label for the destination. */
export async function sendTo(connector: string, link: Link, text: string, image?: Attachment): Promise<string> {
  const title = (text.split("\n")[0] || "Eclipse").slice(0, 120);
  switch (connector) {
    case "telegram": {
      const base = `https://api.telegram.org/bot${link.token}`;
      const r = image ? await call(`${base}/sendPhoto`, json({ chat_id: link.chatId, photo: image.url, caption: text.slice(0, 1000) })) : await call(`${base}/sendMessage`, json({ chat_id: link.chatId, text: text.slice(0, 4000) }));
      if (!r.ok) fail("Telegram", r);
      return `Telegram chat ${link.chatId}`;
    }
    case "slack": {
      const blocks: unknown[] = [{ type: "section", text: { type: "mrkdwn", text: text.slice(0, 2900) || " " } }];
      if (image) blocks.push({ type: "image", image_url: image.url, alt_text: "Eclipse render" });
      const r = await call(link.token, json({ text: text.slice(0, 2900) || "Eclipse", blocks }));
      if (!r.ok) fail("Slack", r);
      return "Slack channel";
    }
    case "discord": {
      // The picture is uploaded as a file (an address would stop working when its signed link expires).
      const url = `${link.token.replace(/\/$/, "")}?wait=true`;
      let r;
      if (image?.bytes) {
        const form = new FormData();
        form.append("payload_json", JSON.stringify({ content: text.slice(0, 1900), allowed_mentions: { parse: [] } }));
        form.append("files[0]", new Blob([Buffer.from(image.bytes)], { type: image.type ?? "image/png" }), image.name ?? "eclipse.png");
        r = await call(url, { method: "POST", body: form });
      } else r = await call(url, json({ content: text.slice(0, 1900) || "Eclipse", allowed_mentions: { parse: [] } }));
      if (!r.ok) fail("Discord", r);
      return "Discord channel";
    }
    case "twilio": {
      const form = new URLSearchParams({ To: link.to, Body: text.slice(0, 1500) || "Eclipse" });
      if (/^MG/i.test(link.from)) form.set("MessagingServiceSid", link.from); else form.set("From", link.from);
      if (image) form.set("MediaUrl", image.url);
      const r = await call(`https://api.twilio.com/2010-04-01/Accounts/${link.sid}/Messages.json`, { method: "POST", headers: { Authorization: basic(link.sid, link.token), "Content-Type": "application/x-www-form-urlencoded" }, body: form });
      if (!r.ok) fail("Twilio", r);
      return `text to ${link.to}`;
    }
    case "sendgrid": {
      const body: Record<string, unknown> = { personalizations: [{ to: [{ email: link.to }] }], from: { email: link.from, name: "Eclipse Studio" }, subject: title, content: [{ type: "text/plain", value: text || "From Eclipse Studio" }] };
      if (image?.bytes) body.attachments = [{ content: Buffer.from(image.bytes).toString("base64"), filename: image.name ?? "eclipse.png", type: image.type ?? "image/png", disposition: "attachment" }];
      const r = await call("https://api.sendgrid.com/v3/mail/send", json(body, { Authorization: `Bearer ${link.token}` }));
      if (!r.ok) fail("SendGrid", r);
      return `email to ${link.to}`;
    }
    case "whatsapp-business": {
      const to = link.to.replace(/^\+/, "");
      const body = image ? { messaging_product: "whatsapp", to, type: "image", image: { link: image.url, caption: text.slice(0, 1000) } } : { messaging_product: "whatsapp", to, type: "text", text: { body: text.slice(0, 4000) || "Eclipse" } };
      const r = await call(`https://graph.facebook.com/v21.0/${link.phoneId}/messages`, json(body, { Authorization: `Bearer ${link.token}` }));
      if (!r.ok) fail("WhatsApp", r);
      return `WhatsApp ${link.to}`;
    }
    case "notion": {
      const children: unknown[] = [{ object: "block", type: "paragraph", paragraph: { rich_text: [{ type: "text", text: { content: text.slice(0, 1900) || "From Eclipse" } }] } }];
      if (image?.link7) children.push({ object: "block", type: "image", image: { type: "external", external: { url: image.link7 } } });
      const r = await call(`https://api.notion.com/v1/blocks/${link.pageId}/children`, { method: "PATCH", headers: { Authorization: `Bearer ${link.token}`, "Notion-Version": "2022-06-28", "Content-Type": "application/json" }, body: JSON.stringify({ children }) });
      if (!r.ok) fail("Notion", r);
      return "Notion page";
    }
    case "linear": {
      const description = `${text}${image?.link7 ? `\n\n![Eclipse render](${image.link7})` : ""}`;
      const r = await call("https://api.linear.app/graphql", json({ query: "mutation($i: IssueCreateInput!) { issueCreate(input: $i) { success issue { identifier } } }", variables: { i: { teamId: link.teamId, title, description } } }, { Authorization: link.token }));
      const id = (() => { try { return JSON.parse(r.text)?.data?.issueCreate?.issue?.identifier as string | undefined; } catch { return undefined; } })();
      if (!r.ok || !id) fail("Linear", r);
      return `Linear issue ${id}`;
    }
    case "todoist": {
      const r = await call("https://api.todoist.com/api/v1/tasks", json({ content: title, description: `${text}${image?.link7 ? `\n\n${image.link7}` : ""}`.slice(0, 15000) }, { Authorization: `Bearer ${link.token}` }));
      if (!r.ok) fail("Todoist", r);
      return "Todoist task";
    }
    case "github": {
      const body = `${text}${image?.link7 ? `\n\n![Eclipse render](${image.link7})` : ""}`;
      const r = await call(`https://api.github.com/repos/${link.repo}/issues`, json({ title, body }, { Authorization: `Bearer ${link.token}`, Accept: "application/vnd.github+json", "User-Agent": "EclipseStudio" }));
      if (!r.ok) fail("GitHub", r);
      return `GitHub issue in ${link.repo}`;
    }
    case "jira": {
      const para = (s: string) => ({ type: "paragraph", content: [{ type: "text", text: s }] });
      const description = { type: "doc", version: 1, content: [para(text || title), ...(image?.link7 ? [para(image.link7)] : [])] };
      const r = await call(`https://${link.site}/rest/api/3/issue`, json({ fields: { project: { key: link.project }, summary: title, issuetype: { name: "Task" }, description } }, { Authorization: basic(link.email, link.token), Accept: "application/json" }));
      if (!r.ok) fail("Jira", r);
      return `Jira ${link.project}`;
    }
  }
  throw new SendError("Unsupported app.");
}

/** Apps whose credential is proved by a read (verify) instead of a test message. */
export const VERIFY_ONLY = new Set(Object.entries(directConnectors).filter(([, c]) => c.verifyOnly).map(([id]) => id));
