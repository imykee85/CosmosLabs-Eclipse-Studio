import Link from "next/link";
import { Brain, MessageSquare, Puzzle, Wrench } from "lucide-react";
import BrandLogo from "./brands";

const ITEMS = [
  { href: "/connect", label: "Chat", icon: <MessageSquare size={15} /> },
  { href: "/skills", label: "Skills", icon: <Puzzle size={15} /> },
  { href: "/tools", label: "Tools", icon: <Wrench size={15} /> },
  { href: "/memory", label: "Memory", icon: <Brain size={15} /> },
  { href: "/connect/apps", label: "Connectors", icon: <span className="cn-stack" aria-hidden="true">{["telegram", "slack"].map((b) => <BrandLogo key={b} brand={b} size={18} />)}</span> },
];

// A row of links between the Connect pages, so you can hop between them without going back to Chat first.
export default function ConnectNav({ current }: { current: string }) {
  return (
    <nav className="cn-nav" aria-label="Connect sections">
      {ITEMS.map((i) => (
        <Link key={i.href} href={i.href} className={`cn-navlink ${i.href === current ? "is-on" : ""}`} aria-current={i.href === current ? "page" : undefined}>{i.icon} {i.label}</Link>
      ))}
    </nav>
  );
}
