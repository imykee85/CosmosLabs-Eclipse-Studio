import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import Logo from "@/components/Logo";
import "@/app/landing.css";

export default function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="login-shell">
      <div className="login-shape login-shape-top" />
      <div className="login-shape login-shape-left" />
      <div className="login-shape login-shape-right" />
      <Logo className="login-brand" size={56} />
      <Link className="login-back" href="/">
        <ArrowLeft size={15} /> Back to home
      </Link>
      <div style={{ position: "relative", zIndex: 1 }}>{children}</div>
    </main>
  );
}
