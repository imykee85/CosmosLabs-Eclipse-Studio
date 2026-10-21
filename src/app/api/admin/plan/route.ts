import { clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { asPlan, planOf } from "@/lib/access";
import { getAdmin } from "@/lib/admin";
import { db } from "@/lib/db";

// Owner only: give an account a plan by hand (testers, comped accounts), or take the hand-given plan away so its real plan applies again.
// This changes what the account may USE (src/lib/access.ts); it does not change its credits, which come from /api/admin/credits.
export async function POST(req: Request) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email) return NextResponse.json({ error: "Enter the e-mail of the account." }, { status: 400 });
  const wanted = body?.plan === "none" ? null : asPlan(body?.plan);
  if (body?.plan !== "none" && !wanted) return NextResponse.json({ error: "Choose a plan." }, { status: 400 });
  try {
    const found = await (await clerkClient()).users.getUserList({ emailAddress: [email], limit: 1 });
    const user = found.data[0];
    if (!user) return NextResponse.json({ error: "No account uses that e-mail address." }, { status: 404 });
    await db.billingSettings.upsert({ where: { userId: user.id }, create: { userId: user.id, planOverride: wanted }, update: { planOverride: wanted } });
    return NextResponse.json({ email, given: wanted, plan: await planOf(user.id) });
  } catch (err) {
    console.error("giving a plan failed", err);
    return NextResponse.json({ error: "Could not change the plan." }, { status: 500 });
  }
}
