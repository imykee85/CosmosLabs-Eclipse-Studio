import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import Logo from "@/components/Logo";
import ThemeToggle from "@/components/ThemeToggle";
import "@/app/landing.css";

export default function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="login-shell">
      <div className="login-shape login-shape-top" />
      <div className="login-shape login-shape-left" />
      <div className="login-shape login-shape-right" />
      <Logo className="login-brand" size={56} />
      <Link className="login-back" href="/" aria-label="Back" title="Back">
        <ChevronLeft size={26} />
      </Link>
      <ThemeToggle className="login-theme" />
      <div className="auth-slot">{children}</div>
    </main>
  );
}
