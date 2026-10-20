"use client";

import Link from "next/link";
import { Coins, Users } from "lucide-react";
import { useOrganization } from "@clerk/nextjs";
import { clerkEnabled } from "@/lib/clerk-enabled";
import { useEffect, useState } from "react";
import { useCredits } from "@/lib/use-credits";
import { fmtCredits, toCredits } from "@/lib/credit-units";
import { WORKSPACE_KEY } from "@/components/WorkspaceWatcher";

// Whole credits stay as they are (one decimal only when fractional); 1000 becomes 1k, 1250 becomes 1.2k (rounded down so the pill never overstates), 1,000,000 becomes 1M.
function short(units: number): string {
  const n = toCredits(units);
  if (n < 1000) return fmtCredits(units);
  const fmt = (v: number, unit: string) => `${(Math.floor(v * 10) / 10).toString()}${unit}`;
  if (n >= 1_000_000) return fmt(n / 1_000_000, "M");
  if (n >= 1000) return n >= 999_950 ? "999.9k" : fmt(n / 1000, "k");
  return String(n);
}

// Shown only while a team is the active workspace, in the same pill style as the balance beside it, so a member can always see where their work and credits are.
function TeamChipInner({ className, text }: { className: string; text: boolean }) {
  const { organization, isLoaded } = useOrganization();
  if (!isLoaded || !organization) return null;
  return (
    <Link href="/settings?tab=team" className={`${className} ws-team`} title={`Team workspace: ${organization.name}. Credits, projects and the Library are shared with the team.`}>
      <Users size={text ? 15 : 14} /> <span className="ws-team-name">{text ? `Team: ${organization.name}` : organization.name}</span>
    </Link>
  );
}
function TeamChip(props: { className: string; text: boolean }) {
  return clerkEnabled ? <TeamChipInner {...props} /> : null;
}

// The credit balance shown in the header of every screen; it opens Billing. Until the balance is known the number is left blank (never 0).
export default function CreditsPill({ className, text = false }: { className: string; text?: boolean }) {
  const { credits } = useCredits();
  const [team, setTeam] = useState<string | null>(null);
  useEffect(() => { try { setTeam((JSON.parse(localStorage.getItem(WORKSPACE_KEY) ?? "null") as { name?: string | null } | null)?.name ?? null); } catch {} }, []);
  const n = credits ? short(credits.balance) : "";
  const full = credits ? `${fmtCredits(credits.balance)} credit${credits.balance === 10 ? "" : "s"}` : "Credits";
  const title = (credits && !credits.charging ? `${full} (not charged yet)` : full) + (team ? ` (team ${team})` : "") + (credits?.expiring ? `. ${fmtCredits(credits.expiring.amount)} credits expire on ${new Date(credits.expiring.at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}` : "");
  return (
    <>
      <TeamChip className={className} text={text} />
      <Link href="/settings?tab=billing" className={className} title={title}>
        <Coins size={text ? 15 : 14} /> {n && (text ? `${n} credits` : n)}
      </Link>
    </>
  );
}
