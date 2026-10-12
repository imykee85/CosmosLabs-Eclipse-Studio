import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import ProjectGate from "@/components/workspace/ProjectGate";
import WorkspaceShell from "@/components/workspace/WorkspaceShell";
import { clerkEnabled } from "@/lib/clerk-enabled";
import { db } from "@/lib/db";

// App screens use the same viewport as every other page (the phone layout width is set by PHONE_LAYOUT_SCRIPT in the root layout). A maximum-scale here broke the phone layout (2026-10-12), so iPhone Safari is stopped from zooming into a tapped text box by keeping text boxes at 16px or more instead.
export const viewport = { viewportFit: "cover" } as const;

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // New accounts answer the onboarding questions first; if the database can't be reached, let them in.
  if (clerkEnabled) {
    const { userId } = auth();
    if (userId) {
      const done = await db.onboarding.findUnique({ where: { userId } }).catch(() => true);
      if (!done) redirect("/onboarding");
    }
  }
  return <ProjectGate><WorkspaceShell>{children}</WorkspaceShell></ProjectGate>;
}
