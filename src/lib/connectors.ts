// Apps Connect will link to. Nothing here connects yet: real connections need sign-in with each service and a backend.
// Descriptions are Eclipse's own wording. Add or remove entries freely; `brand` is mapped to a logo in components/connect/brands.tsx.
export type Connector = { name: string; blurb: string; brand: string };

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
