import { NextResponse, type NextRequest } from "next/server";
import { verifyWebhook } from "@clerk/nextjs/webhooks";
import { emailOwner } from "@/lib/email";
import { claimUsage } from "@/lib/usage";

// Clerk calls this when something happens to an account. Only "user.created" is used: it emails the owner "New sign-up".
// Public in the proxy (Clerk has no sign-in), so the signature check (CLERK_WEBHOOK_SIGNING_SECRET, a Secret) is the only gate.
// The email goes to the owner only, so it may carry the new person's address; nothing else about them is sent.
export const maxDuration = 20;

export async function POST(req: NextRequest) {
  let evt;
  try { evt = await verifyWebhook(req); } catch { return NextResponse.json({ error: "Bad signature." }, { status: 400 }); }
  if (evt.type !== "user.created") return NextResponse.json({ ok: true });
  const u = evt.data as { id?: string; created_at?: number; primary_email_address_id?: string | null; email_addresses?: { id?: string; email_address?: string }[] };
  const email = (u.email_addresses ?? []).find((e) => e.id === u.primary_email_address_id)?.email_address ?? u.email_addresses?.[0]?.email_address ?? "(no email)";
  // Clerk retries a delivery it thinks failed: one email per account.
  if (u.id && !(await claimUsage("ops", `signup:${u.id}`.slice(0, 80), 1, 7 * 86_400_000))) return NextResponse.json({ ok: true, duplicate: true });
  const when = new Date(u.created_at ?? Date.now()).toISOString().replace("T", " ").slice(0, 16);
  await emailOwner("New sign-up on Eclipse", `Someone just signed up.\n\nAccount: ${email}\nTime (UTC): ${when}\n\nSee everyone at /admin/users.`);
  return NextResponse.json({ ok: true });
}
