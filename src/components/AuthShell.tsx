import Link from "next/link";
import { Camera, ChevronLeft, Palette } from "lucide-react";
import AgentIcon from "@/components/AgentIcon";
import ConnectIcon from "@/components/ConnectIcon";
import ThemeToggle from "@/components/ThemeToggle";
import "@/app/landing.css";

export default function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="login-shell">
      <div className="login-bg" aria-hidden="true">
      <span className="login-icon login-icon-top" aria-hidden="true"><AgentIcon size={200} /></span>
      <span className="login-icon login-icon-left" aria-hidden="true"><Camera size={240} strokeWidth={1} /></span>
      <span className="login-icon login-icon-right" aria-hidden="true"><Palette size={210} strokeWidth={1} /></span>
      <span className="login-icon login-icon-bottom" aria-hidden="true"><ConnectIcon size={200} strokeWidth={1.1} /></span>
      </div>
      <Link className="login-back" href="/" aria-label="Back" title="Back">
        <ChevronLeft size={26} />
      </Link>
      <ThemeToggle className="login-theme" />
      <div className="auth-slot">{children}</div>
    </main>
  );
}
