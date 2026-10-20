"use client";

import { useEffect } from "react";
import { useClerk, useUser } from "@clerk/nextjs";

// Reads the team invitations waiting for the signed-in person (Clerk keeps them against their e-mail address) and hands them to the notifications
// panel. Renders nothing itself. Only mounted when Clerk is on.
export type TeamInvite = { id: string; team: string; role: string; at: string; join: () => Promise<void> };

const roleName = (r: string) => (r === "org:admin" ? "Admin" : "Member");

export default function TeamInviteFeed({ onChange }: { onChange: (list: TeamInvite[]) => void }) {
  const { user, isLoaded } = useUser();
  const clerk = useClerk();
  useEffect(() => {
    if (!isLoaded || !user) { onChange([]); return; }
    let live = true;
    const load = async () => {
      if (document.visibilityState === "hidden") return;
      try {
        const res = await user.getOrganizationInvitations({ status: "pending", pageSize: 20 });
        if (!live) return;
        onChange(res.data.map((inv) => ({
          id: inv.id,
          team: inv.publicOrganizationData.name,
          role: roleName(inv.role),
          at: inv.createdAt.toISOString(),
          join: async () => {
            await inv.accept();
            await clerk.setActive({ organization: inv.publicOrganizationData.id }); // work in the team straight away
            await load();
          },
        })));
      } catch { /* teams switched off, or no network: no invitations to show */ }
    };
    void load();
    const t = setInterval(load, 60_000);
    const vis = () => void load();
    document.addEventListener("visibilitychange", vis);
    return () => { live = false; clearInterval(t); document.removeEventListener("visibilitychange", vis); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, user?.id]);
  return null;
}
