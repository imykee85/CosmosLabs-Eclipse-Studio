import { currentUser } from "@clerk/nextjs/server";
import { clerkEnabled } from "./clerk-enabled";

// The owner(s) who may hand out credits: the e-mail addresses listed in ADMIN_EMAILS (comma-separated) in Vercel. Nobody is an admin without it.
export async function getAdmin(): Promise<{ userId: string; email: string } | null> {
  if (!clerkEnabled) return null;
  const list = (process.env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  if (!list.length) return null;
  const user = await currentUser();
  if (!user) return null;
  // Only a verified address counts, so nobody can claim an admin's address without proving it.
  const hit = user.emailAddresses.find((e) => e.verification?.status === "verified" && list.includes(e.emailAddress.toLowerCase()));
  return hit ? { userId: user.id, email: hit.emailAddress } : null;
}
