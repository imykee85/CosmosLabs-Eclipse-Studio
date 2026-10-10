import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import ProjectGate from "@/components/workspace/ProjectGate";
import WorkspaceShell from "@/components/workspace/WorkspaceShell";
import { clerkEnabled } from "@/lib/clerk-enabled";
import { db } from "@/lib/db";

// App screens only: stops iPhone Safari zooming the page in when a text box is tapped (it also pushed the prompt box out of view). The marketing site keeps pinch zoom.
export const viewport = { width: "device-width", initialScale: 1, maximumScale: 1 };

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
