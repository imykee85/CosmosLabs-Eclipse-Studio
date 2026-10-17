// Apps Connect links to. The ones in `directConnectors` really connect with something the person pastes in (a bot token, a webhook address,
// an API key) and the agent can send to them (src/lib/connector-send.ts). The others need a sign-in approved by the service; their connect
// button says plainly that this server has no app registered with the service yet (src/app/api/connectors).
// Descriptions are Eclipse's own wording. `brand` is mapped to a logo in components/connect/brands.tsx.
export type Connector = { name: string; blurb: string; brand: string };

const slug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
export const connectorId = (c: Connector) => slug(c.name);

// What the user pastes to connect, for the apps that connect directly.
export type ConnectField = { key: string; label: string; hint: string; secret?: boolean; optional?: boolean };
export const directConnectors: Record<string, { help: string; fields: ConnectField[]; verifyOnly?: boolean }> = {
  telegram: {
    help: "Create a bot with @BotFather, send it any message, then paste its token and the chat id you want content delivered to.",
    fields: [
      { key: "token", label: "Bot token", hint: "123456:ABC-DEF...", secret: true },
      { key: "chatId", label: "Chat id", hint: "For example 123456789 or @yourchannel" },
    ],
  },
  slack: {
    help: "In Slack, add an Incoming Webhook to a channel and paste its address here.",
    fields: [{ key: "token", label: "Webhook address", hint: "https://hooks.slack.com/services/...", secret: true }],
  },
  discord: {
    help: "In your Discord server: Server Settings, Integrations, Webhooks, New Webhook. Pick the channel, copy the webhook address and paste it here.",
    fields: [{ key: "token", label: "Webhook address", hint: "https://discord.com/api/webhooks/...", secret: true }],
  },
  twilio: {
    help: "From your Twilio Console: the Account SID and Auth Token, the Twilio number you send from, and the number to send to. Pictures go as MMS where Twilio supports it.",
    fields: [
      { key: "sid", label: "Account SID", hint: "AC..." },
      { key: "token", label: "Auth Token", hint: "32 characters", secret: true },
      { key: "from", label: "From number", hint: "+15551234567" },
      { key: "to", label: "Send to", hint: "+15557654321" },
    ],
  },
  sendgrid: {
    help: "Create an API key with Mail Send access in SendGrid, and use a sender address you verified there.",
    fields: [
      { key: "token", label: "API key", hint: "SG....", secret: true },
      { key: "from", label: "Send from", hint: "you@yourbrand.com" },
      { key: "to", label: "Send to", hint: "client@example.com" },
    ],
  },
  "whatsapp-business": {
    help: "In Meta for Developers, open your WhatsApp Business app: copy a permanent access token and the phone number ID. Free-form messages reach a number only within 24 hours of its last message to you.",
    fields: [
      { key: "token", label: "Access token", hint: "EAAG...", secret: true },
      { key: "phoneId", label: "Phone number ID", hint: "1234567890123" },
      { key: "to", label: "Send to", hint: "+15557654321" },
    ],
  },
  notion: {
    help: "Create an internal integration at notion.so/my-integrations, share the page with it (••• menu, Connections), then paste its secret and the page address. Messages are added to the end of the page.",
    fields: [
      { key: "token", label: "Integration secret", hint: "ntn_...", secret: true },
      { key: "pageId", label: "Page address", hint: "https://www.notion.so/..." },
    ],
    verifyOnly: true,
  },
  linear: {
    help: "Create a personal API key in Linear (Settings, Security & access). Each message becomes an issue in the team you name (or your first team).",
    fields: [
      { key: "token", label: "API key", hint: "lin_api_...", secret: true },
      { key: "team", label: "Team key (optional)", hint: "ENG", optional: true },
    ],
    verifyOnly: true,
  },
  todoist: {
    help: "Copy your API token from Todoist (Settings, Integrations, Developer). Each message becomes a task in your Inbox.",
    fields: [{ key: "token", label: "API token", hint: "40 characters", secret: true }],
    verifyOnly: true,
  },
  github: {
    help: "Create a fine-grained personal access token with Issues read and write on the repository. Each message becomes an issue.",
    fields: [
      { key: "token", label: "Access token", hint: "github_pat_...", secret: true },
      { key: "repo", label: "Repository", hint: "owner/name" },
    ],
    verifyOnly: true,
  },
  jira: {
    help: "Create an API token at id.atlassian.com (Security, API tokens). Each message becomes a Task in the project you name.",
    fields: [
      { key: "site", label: "Jira site", hint: "yourteam.atlassian.net" },
      { key: "email", label: "Account email", hint: "you@company.com" },
      { key: "token", label: "API token", hint: "ATATT...", secret: true },
      { key: "project", label: "Project key", hint: "CREA" },
    ],
    verifyOnly: true,
  },
};

export const connectorGroups: { title: string; icon: string; items: Connector[] }[] = [
  {
    title: "Social", icon: "share",
    items: [
      { name: "TikTok", blurb: "Post finished renders to your account straight from chat.", brand: "tiktok" },
      { name: "Instagram", blurb: "Share images and reels without leaving your project.", brand: "instagram" },
      { name: "YouTube", blurb: "Publish videos and Shorts the moment they are ready.", brand: "youtube" },
    ],
  },
  {
    title: "Communication", icon: "message",
    items: [
      { name: "Telegram", blurb: "Talk to your agents from your phone and get renders back in chat.", brand: "telegram" },
      { name: "WhatsApp Business", blurb: "Send finished content to clients and teammates.", brand: "whatsapp" },
      { name: "Slack", blurb: "Get renders and reviews delivered to your channels.", brand: "slack" },
      { name: "Discord", blurb: "Share work with your community or team server.", brand: "discord" },
      { name: "Twilio", blurb: "Send text messages and calls from your workflows.", brand: "twilio" },
    ],
  },
  {
    title: "Email & Calendar", icon: "mail",
    items: [
      { name: "Gmail", blurb: "Draft and send emails with your finished work attached.", brand: "gmail" },
      { name: "Google Calendar", blurb: "Plan shoots and publishing dates on your calendar.", brand: "gcal" },
      { name: "SendGrid", blurb: "Send campaign emails with your new visuals.", brand: "sendgrid" },
      { name: "Microsoft Outlook", blurb: "Email and calendar from your work account.", brand: "outlook" },
    ],
  },
  {
    title: "Documents", icon: "docs",
    items: [
      { name: "Google Drive", blurb: "Import brand files and references into your library.", brand: "gdrive" },
      { name: "Google Docs", blurb: "Pull briefs and scripts from your documents.", brand: "gdocs" },
      { name: "Microsoft OneDrive", blurb: "Bring files from your work account into a project.", brand: "onedrive" },
      { name: "Notion", blurb: "Read briefs and notes straight from your pages.", brand: "notion" },
      { name: "Google Sheets", blurb: "Use spreadsheet rows as product lists and captions.", brand: "gsheets" },
      { name: "Dropbox", blurb: "Pull product photos and footage from your folders.", brand: "dropbox" },
    ],
  },
  {
    title: "Management", icon: "tasks",
    items: [
      { name: "HubSpot", blurb: "Keep campaigns and contacts in step with your content.", brand: "hubspot" },
      { name: "Linear", blurb: "Turn review notes into tasks for your team.", brand: "linear" },
      { name: "Jira", blurb: "Track creative requests alongside your other projects.", brand: "jira" },
      { name: "Todoist", blurb: "Add to-dos for every remake and approval.", brand: "todoist" },
      { name: "Salesforce", blurb: "Match content to the accounts and deals it supports.", brand: "salesforce" },
    ],
  },
  {
    title: "Development", icon: "code",
    items: [
      { name: "GitHub", blurb: "Keep scripts and assets under version control.", brand: "github" },
      { name: "Supabase", blurb: "Read and write your own database from a workflow.", brand: "supabase" },
    ],
  },
  {
    title: "Video & Media", icon: "video",
    items: [
      { name: "Whisper", blurb: "Turn recordings and voice notes into text.", brand: "openai" },
      { name: "YouTube Analytics", blurb: "Views and retention for every video you ship.", brand: "youtube" },
      { name: "Vimeo", blurb: "Host and share your videos with review links.", brand: "vimeo" },
      { name: "Frame.io", blurb: "Collect comments and approvals on your cuts.", brand: "frameio" },
    ],
  },
];

// The "Best workflows" row: each pairs an app with what it lets you do from Connect.
export const connectorWorkflows = [
  { title: "Chat with your agents on Telegram", brand: "telegram", art: "chat" },
  { title: "Post finished content to TikTok from chat", brand: "tiktok", art: "post" },
  { title: "Get renders delivered to Slack", brand: "slack", art: "chat" },
  { title: "Pull brand files in from Google Drive", brand: "gdrive", art: "post" },
] as const;
