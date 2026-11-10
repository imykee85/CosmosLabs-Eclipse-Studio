import Link from "next/link";
import { Headset, Mail } from "lucide-react";
import "./support.css";

// Set NEXT_PUBLIC_CONTACT_EMAIL (a Config value) to show the support address.
const EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "";

const TOPICS = [
  { title: "Credits and billing", text: "Your balance, plan, top-ups, cards and invoices.", href: "/settings?tab=billing", cta: "Open Billing" },
  { title: "Cancel your plan", text: "Cancel at the end of the period you have paid for.", href: "/settings?tab=billing", cta: "Open Billing" },
  { title: "Your account", text: "Name, password, language and deleting your account.", href: "/settings", cta: "Open Settings" },
  { title: "Learn Eclipse", text: "Lessons on every studio.", href: "/tutorial", cta: "Open Academy" },
  { title: "Terms and privacy", text: "How Eclipse works with your data and your creations.", href: "/terms", cta: "Read the Terms" },
];

export default function SupportView() {
  return (
    <div className="ws-ing sp">
      <h1>Support</h1>
      <section className="sp-contact" aria-label="Contact support">
        <span className="sp-icon" aria-hidden="true"><Headset size={22} /></span>
        <div>
          <b>Contact support</b>
          {EMAIL
            ? <p>Write to <a href={`mailto:${EMAIL}?subject=Eclipse%20support`}>{EMAIL}</a> and include what you were doing and the page you were on.</p>
            : <p>The support address is not set up yet.</p>}
        </div>
        {EMAIL && <a className="sp-btn" href={`mailto:${EMAIL}?subject=Eclipse%20support`}><Mail size={15} />Email us</a>}
      </section>
      <ul className="sp-list">
        {TOPICS.map((t) => (
          <li key={t.title} className="sp-card">
            <div><b>{t.title}</b><p>{t.text}</p></div>
            <Link className="sp-btn" href={t.href}>{t.cta}</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
