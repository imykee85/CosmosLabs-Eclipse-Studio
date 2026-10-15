import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getAdmin } from "@/lib/admin";
import { clerkEnabled } from "@/lib/clerk-enabled";
import { getBalance } from "@/lib/credits";
import { db } from "@/lib/db";

// The signed-in user's credit balance and recent activity.
export async function GET() {
  if (!clerkEnabled) return NextResponse.json({ error: "Preview mode" }, { status: 503 });
  const { userId } = auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const [balance, rows, admin] = await Promise.all([
      getBalance(userId),
      db.creditLedger.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 25 }),
      getAdmin(),
    ]);
    return NextResponse.json({
      balance,
      charging: process.env.CREDITS_ENABLED === "1",
      isAdmin: Boolean(admin),
      history: rows.map((r) => ({ id: r.id, delta: r.delta, reason: r.reason, note: r.note, createdAt: r.createdAt })),
    });
  } catch (err) {
    console.error("loading credits failed", err);
    return NextResponse.json({ error: "Could not load your credits." }, { status: 500 });
  }
}
