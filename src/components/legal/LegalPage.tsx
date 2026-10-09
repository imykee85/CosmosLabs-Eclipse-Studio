import Link from "next/link";
import { LogoMark } from "@/components/Logo";
import "./legal.css";

export const LAST_UPDATED = "9 October 2026";
// Set NEXT_PUBLIC_CONTACT_EMAIL to show a contact address on the legal pages.
export const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "";

export function Contact() {
  return CONTACT_EMAIL
    ? <p>Questions about this page: <a className="lg-link" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</p>
    : <p>Questions about this page can be sent to Cosmos Labs AI through the support contact shown in your Eclipse account.</p>;
}

export default function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="lg">
      <div className="lg-wrap">
        <div className="lg-top">
          <Link href="/" aria-label="Eclipse home"><LogoMark size={40} /></Link>
          <Link href="/">Back to Eclipse</Link>
        </div>
        <h1>{title}</h1>
        <p className="lg-date">Last updated {LAST_UPDATED}</p>
        {children}
        <div className="lg-foot">
          <Link href="/terms">Terms of Use</Link>
          <Link href="/privacy">Privacy Policy</Link>
        </div>
      </div>
    </main>
  );
}
