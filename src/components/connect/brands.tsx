import { Cloud, Film, Mail, type LucideIcon } from "lucide-react";
import {
  siDropbox, siDiscord, siGithub, siGmail, siGooglecalendar, siGoogledocs, siGoogledrive, siGooglesheets, siHubspot, siInstagram, siJira, siLinear,
  siNotion, siOpenai, siSalesforce, siSendgrid, siSlack, siSupabase, siTelegram, siTiktok, siTodoist, siTwilio, siVimeo, siWhatsapp, siYoutube,
  type SimpleIcon,
} from "simple-icons";

// Logos come from the open Simple Icons set (one colour per brand, so multi-colour marks such as Google's are shown in a single brand colour).
// Outlook, OneDrive and Frame.io are not in that set and use a plain stand-in glyph on the brand colour. All marks belong to their owners.
type Brand = { icon: SimpleIcon | LucideIcon; bg: string; fg: string };
const white = "#ffffff";

export const BRANDS: Record<string, Brand> = {
  telegram: { icon: siTelegram, bg: "linear-gradient(180deg, #37aee2, #1e96c8)", fg: white },
  whatsapp: { icon: siWhatsapp, bg: "#25d366", fg: white },
  slack: { icon: siSlack, bg: white, fg: "#4a154b" },
  discord: { icon: siDiscord, bg: "#5865f2", fg: white },
  twilio: { icon: siTwilio, bg: "#f22f46", fg: white },
  gmail: { icon: siGmail, bg: white, fg: "#ea4335" },
  gcal: { icon: siGooglecalendar, bg: white, fg: "#4285f4" },
  sendgrid: { icon: siSendgrid, bg: white, fg: "#1a82e2" },
  outlook: { icon: Mail, bg: "#0a64ad", fg: white },
  gdrive: { icon: siGoogledrive, bg: white, fg: "#1fa463" },
  gdocs: { icon: siGoogledocs, bg: white, fg: "#4285f4" },
  onedrive: { icon: Cloud, bg: "#0f6cbd", fg: white },
  notion: { icon: siNotion, bg: white, fg: "#000000" },
  gsheets: { icon: siGooglesheets, bg: white, fg: "#34a853" },
  dropbox: { icon: siDropbox, bg: "#0061ff", fg: white },
  hubspot: { icon: siHubspot, bg: "#ff7a59", fg: white },
  linear: { icon: siLinear, bg: "#222326", fg: white },
  jira: { icon: siJira, bg: "#0052cc", fg: white },
  todoist: { icon: siTodoist, bg: "#e44332", fg: white },
  salesforce: { icon: siSalesforce, bg: "#00a1e0", fg: white },
  github: { icon: siGithub, bg: "#24292f", fg: white },
  supabase: { icon: siSupabase, bg: "#3ecf8e", fg: white },
  openai: { icon: siOpenai, bg: "#202123", fg: white },
  youtube: { icon: siYoutube, bg: "#ff0000", fg: white },
  vimeo: { icon: siVimeo, bg: "#1ab7ea", fg: white },
  frameio: { icon: Film, bg: "#5b50f5", fg: white },
  tiktok: { icon: siTiktok, bg: "#000000", fg: white },
  instagram: { icon: siInstagram, bg: "linear-gradient(45deg, #f9a03c, #e1306c 55%, #7b3fc4)", fg: white },
};

export default function BrandLogo({ brand, size = 48 }: { brand: string; size?: number }) {
  const b = BRANDS[brand];
  if (!b) return <span className="cn-logo" style={{ width: size, height: size }} />;
  const glyph = Math.round(size * 0.5);
  const Icon = b.icon;
  return (
    <span className="cn-logo" style={{ width: size, height: size, background: b.bg, color: b.fg, borderRadius: Math.round(size * 0.29) }} aria-hidden="true">
      {"path" in Icon
        ? <svg viewBox="0 0 24 24" width={glyph} height={glyph} fill="currentColor"><path d={Icon.path} /></svg>
        : <Icon size={glyph} strokeWidth={1.8} />}
    </span>
  );
}
