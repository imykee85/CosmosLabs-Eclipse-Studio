import { auth } from "@clerk/nextjs/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { clerkEnabled } from "@/lib/clerk-enabled";
import { gateFeatureFor } from "@/lib/access";
import { checkAuthRequest, redirectBack } from "@/lib/oauth";
import Consent from "@/components/oauth/Consent";
import "@/components/oauth/oauth.css";

export const dynamic = "force-dynamic";

// Where an outside app (Claude) sends the person to connect Eclipse: sign in if needed, then see what the app is asking for and allow or cancel.
// A bad app or return address is shown here and never redirected to; any other problem goes back to the app as a standard OAuth error.
function Notice({ title, message, link }: { title: string; message: string; link?: { href: string; text: string } }) {
  return (
    <main className="oa-page"><div className="oa-card"><h1>{title}</h1><p>{message}</p>{link && <a className="oa-go" href={link.href}>{link.text}</a>}</div></main>
  );
}

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const p: Record<string, string> = {};
  for (const [k, v] of Object.entries(sp)) { const one = Array.isArray(v) ? v[0] : v; if (typeof one === "string") p[k] = one; }
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const origin = `${h.get("x-forwarded-proto") ?? "https"}://${host}`;
  const check = await checkAuthRequest(p, origin);
  if (!check.ok && check.kind === "page") return <Notice title="Can't connect" message={check.message} />;
  if (!check.ok) redirect(redirectBack(check.redirectUri, { error: check.error, error_description: check.description }, check.state));
  if (!clerkEnabled) return <Notice title="Sign-in is not set up here" message="Eclipse sign-in is not available on this address." />;
  const { userId } = await auth();
  if (!userId) redirect(`/sign-in?next=${encodeURIComponent(`/oauth/authorize?${new URLSearchParams(p).toString()}`)}`);
  const gate = await gateFeatureFor(userId, "api");
  if (!gate.ok) return <Notice title="A paid plan is needed" message={gate.body.error} link={{ href: "/settings?tab=billing", text: "See plans" }} />;
  const { req } = check;
  return <Consent clientName={req.clientName} returnHost={new URL(req.redirectUri).host || new URL(req.redirectUri).protocol} params={{ client_id: p.client_id ?? "", redirect_uri: req.redirectUri, response_type: "code", code_challenge: req.codeChallenge, code_challenge_method: "S256", state: req.state, resource: p.resource ?? "" }} />;
}
