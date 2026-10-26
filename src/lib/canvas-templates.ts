import { clerkEnabled } from "./clerk-enabled";
import { deleteTemplate, loadTemplates, saveTemplate, templateGraph, type CanvasTemplate, type CNode } from "./canvas";
import type { Edge } from "@xyflow/react";

// Canvas templates: the built-in starter flow, the ones saved in the account (they follow the person across devices and are shared with a team) and the ones
// an older version kept in this browser. Without an account (preview mode) or when the account cannot be reached, a new template is kept in this browser.
type ServerItem = { id: string; name: string; data: { nodes?: CNode[]; edges?: Edge[] } | null };

const fromServer = (i: ServerItem): CanvasTemplate | null => (i && Array.isArray(i.data?.nodes) && Array.isArray(i.data?.edges) ? { id: i.id, name: i.name, nodes: i.data!.nodes!, edges: i.data!.edges!, server: true } : null);

export async function listAllTemplates(): Promise<CanvasTemplate[]> {
  const local = loadTemplates();
  if (!clerkEnabled) return local;
  try {
    const res = await fetch("/api/canvas-templates");
    if (!res.ok) return local;
    const items = ((await res.json()).items ?? []).map(fromServer).filter((t: CanvasTemplate | null): t is CanvasTemplate => !!t);
    return [...local.filter((t) => t.builtIn), ...items, ...local.filter((t) => !t.builtIn)];
  } catch { return local; }
}

export async function saveAnyTemplate(name: string, nodes: CNode[], edges: Edge[]): Promise<{ list: CanvasTemplate[]; error?: string }> {
  if (clerkEnabled) {
    try {
      const res = await fetch("/api/canvas-templates", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, ...templateGraph(nodes, edges) }) });
      if (res.ok) return { list: await listAllTemplates() };
      const d = await res.json().catch(() => ({}));
      if (res.status !== 503 && res.status !== 401) return { list: await listAllTemplates(), error: typeof d.error === "string" ? d.error : "Could not save the template." };
    } catch {}
  }
  saveTemplate(name, nodes, edges);
  return { list: await listAllTemplates() };
}

export async function deleteAnyTemplate(t: CanvasTemplate): Promise<CanvasTemplate[]> {
  if (t.server) { try { await fetch(`/api/canvas-templates/${t.id}`, { method: "DELETE" }); } catch {} }
  else deleteTemplate(t.id);
  return listAllTemplates();
}
