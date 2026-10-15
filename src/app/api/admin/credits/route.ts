import { clerkClient } from "@clerk/nextjs/server";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getAdmin } from "@/lib/admin";
import { getBalance, grantCredits } from "@/lib/credits";

const MAX_GRANT = 100_000;

// Owner only: add credits to an account (yours when no e-mail is given). Every grant is recorded in the ledger with who gave it.
export async function POST(req: Request) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "Not allowed" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const amount = Number(body?.amount);
  if (!Number.isInteger(amount) || amount < 1 || amount > MAX_GRANT) return NextResponse.json({ error: `Enter a whole number of credits from 1 to ${MAX_GRANT.toLocaleString("en-US")}.` }, { status: 400 });
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const note = typeof body?.note === "string" ? body.note.trim().slice(0, 120) : "";

  try {
    let targetId = admin.userId;
    let targetEmail = admin.email;
    if (email && email !== admin.email.toLowerCase()) {
      const found = await clerkClient.users.getUserList({ emailAddress: [email], limit: 1 });
      const user = found.data[0];
      if (!user) return NextResponse.json({ error: "No account uses that e-mail address." }, { status: 404 });
      targetId = user.id;
      targetEmail = email;
    }
    await grantCredits(targetId, amount, { reason: "GRANT", provider: "admin", externalId: randomUUID(), note: `${note || "Credits added"} (by ${admin.email})` });
    return NextResponse.json({ email: targetEmail, added: amount, balance: await getBalance(targetId) });
  } catch (err) {
    console.error("granting credits failed", err);
    return NextResponse.json({ error: "Could not add the credits." }, { status: 500 });
  }
}
