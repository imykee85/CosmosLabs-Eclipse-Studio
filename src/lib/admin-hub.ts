import { clerkClient } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { adminPasswordSet } from "@/lib/admin-gate";
import { emailConfigured } from "@/lib/email";

// Numbers for the top of the admin dashboard. Counts only, never anyone's content.
export async function hubStats() {
  const day = new Date(Date.now() - 86_400_000);
  const [images, videos, failed, running, audio, models3d] = await Promise.all([
    db.generation.count({ where: { kind: { not: "video" }, status: "completed", createdAt: { gte: day } } }),
    db.generation.count({ where: { kind: "video", status: "completed", createdAt: { gte: day } } }),
    db.generation.count({ where: { status: "failed", createdAt: { gte: day } } }),
    db.generation.count({ where: { status: { in: ["pending", "saving"] } } }),
    db.audioJob.count({ where: { status: "completed", createdAt: { gte: day } } }),
    db.model3D.count({ where: { status: "completed", createdAt: { gte: day } } }),
  ]);
  let accounts: number | null = null, newToday: number | null = null, newWeek: number | null = null;
  try {
    const c = await clerkClient();
    accounts = await c.users.getCount();
    const recent = await c.users.getUserList({ orderBy: "-created_at", limit: 100 });
    newToday = recent.data.filter((u) => Date.now() - u.createdAt < 86_400_000).length;
    newWeek = recent.data.filter((u) => Date.now() - u.createdAt < 7 * 86_400_000).length;
  } catch { /* Clerk unreachable: leave the sign-up numbers out */ }
  return { accounts, newToday, newWeek, images, videos, failed, running, audio, models3d };
}

/** What is set up for the owner's own tools (names and yes or no only; never a value). */
export function setupChecklist(): { name: string; ok: boolean; note: string }[] {
  return [
    { name: "Admin password", ok: adminPasswordSet(), note: "Secret ADMIN_PASSWORD (8 characters or more). Until it is set, the admin area is open to your owner account without a password." },
    { name: "Emails to you", ok: emailConfigured(), note: "Secret RESEND_API_KEY and Config ALERT_EMAIL." },
    { name: "New sign-up email", ok: Boolean(process.env.CLERK_WEBHOOK_SIGNING_SECRET), note: "Secret CLERK_WEBHOOK_SIGNING_SECRET, and the Clerk webhook for user.created." },
    { name: "Charging with credits", ok: process.env.CREDITS_ENABLED === "1", note: "Config CREDITS_ENABLED=1." },
    { name: "Plan locks", ok: process.env.PLAN_GATING !== "off", note: "Config PLAN_GATING=off turns every plan check off: leave it unset." },
  ];
}
