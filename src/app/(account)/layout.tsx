import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import AccountShell from "@/components/AccountShell";
import { clerkEnabled } from "@/lib/clerk-enabled";
import { db } from "@/lib/db";
import { requireTerms } from "@/lib/terms-db";

// Pages opened from the avatar menu (Avatars, Portfolio, Certificates, Settings). They sit outside the Studio, so no Studio tabs.
export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  await requireTerms("/dashboard");
  if (clerkEnabled) {
    const { userId } = await auth();
    if (userId) {
      const done = await db.onboarding.findUnique({ where: { userId } }).catch(() => true);
      if (!done) redirect("/onboarding");
    }
  }
  return <AccountShell>{children}</AccountShell>;
}
