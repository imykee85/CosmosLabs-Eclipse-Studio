// Apps Orbit will connect to. Everything here is "Soon": real connections need sign-in with each service and a backend.
// Descriptions are Eclipse's own wording. Add or remove entries freely; `icon` is mapped in components/orbit/ConnectView.tsx.
export type Connector = { name: string; blurb: string; icon: string };

export const connectorGroups: { title: string; icon: string; items: Connector[] }[] = [
  {
    title: "Publish", icon: "megaphone",
    items: [
      { name: "TikTok", blurb: "Post finished renders to your account straight from Orbit.", icon: "music" },
      { name: "Instagram", blurb: "Share images and reels without leaving your project.", icon: "share" },
      { name: "YouTube", blurb: "Publish videos and Shorts when they are ready.", icon: "share" },
    ],
  },
  {
    title: "Insights", icon: "chart",
    items: [
      { name: "TikTok insights", blurb: "Bring real results back so Agent 3 can see what works.", icon: "chart" },
      { name: "Instagram insights", blurb: "Reach and engagement for the content you published.", icon: "chart" },
      { name: "YouTube analytics", blurb: "Views and retention for every video you ship.", icon: "chart" },
    ],
  },
  {
    title: "Files", icon: "folder",
    items: [
      { name: "Google Drive", blurb: "Import brand files and references into your library.", icon: "cloud" },
      { name: "Dropbox", blurb: "Pull product photos and footage from your folders.", icon: "cloud" },
      { name: "OneDrive", blurb: "Bring files from your work account into a project.", icon: "cloud" },
      { name: "Notion", blurb: "Read briefs and notes straight from your pages.", icon: "notes" },
    ],
  },
  {
    title: "Messaging", icon: "message",
    items: [
      { name: "Telegram", blurb: "Talk to Orbit from your phone and get renders back in chat.", icon: "send" },
      { name: "WhatsApp Business", blurb: "Send finished content to clients and teammates.", icon: "message" },
      { name: "Slack", blurb: "Get renders and reviews delivered to your channels.", icon: "hash" },
      { name: "Discord", blurb: "Share work with your community or team server.", icon: "game" },
    ],
  },
];

export const connectorWorkflows = [
  { title: "Publish to TikTok from chat", sub: "Make it, review it, post it" },
  { title: "Get renders delivered in Slack", sub: "Your team sees work as it lands" },
  { title: "Pull brand files from Drive", sub: "Start every project from your assets" },
];
