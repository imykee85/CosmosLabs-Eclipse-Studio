"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { clearCurrentProject, listProjects, readCurrentProject } from "@/lib/projects";

// The Studio is only reachable through a project: without an open, un-deleted project we go back to the dashboard.
export default function ProjectGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ok, setOk] = useState(false);

  useEffect(() => {
    let live = true;
    const current = readCurrentProject();
    const leave = () => { clearCurrentProject(); router.replace("/dashboard"); };
    if (!current) { leave(); return; }
    listProjects()
      .then((all) => {
        if (!live) return;
        const p = all.find((x) => x.id === current.id);
        if (!p || p.deletedAt) leave(); else setOk(true);
      })
      .catch(() => { if (live) setOk(true); }); // can't verify (offline / server error): keep the open project
    return () => { live = false; };
  }, [router]);

  return ok ? <>{children}</> : null;
}
