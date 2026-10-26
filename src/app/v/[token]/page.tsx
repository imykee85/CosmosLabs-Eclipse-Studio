import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { validToken } from "@/lib/canvas-api";
import SharedBoard, { type SharedNode, type SharedEdge } from "./SharedBoard";
import "./viewer.css";

export const dynamic = "force-dynamic";

async function load(token: string) {
  if (!validToken(token)) return null;
  const c = await db.canvas.findFirst({ where: { share: { is: { token } }, deletedAt: null }, select: { name: true, data: true } }).catch(() => null);
  if (!c) return null;
  const d = c.data as { nodes?: SharedNode[]; edges?: SharedEdge[] } | null;
  if (!d || !Array.isArray(d.nodes) || !Array.isArray(d.edges)) return null;
  // Only what the viewer needs: layout, wiring and the content of each node (errors and notes stay private).
  const nodes: SharedNode[] = d.nodes.slice(0, 300).map((n) => ({ id: String(n.id), type: String(n.type), position: { x: Number(n.position?.x) || 0, y: Number(n.position?.y) || 0 }, width: n.width, height: n.height, zIndex: n.zIndex, data: { ...n.data, error: undefined, note: undefined } }));
  const edges: SharedEdge[] = d.edges.slice(0, 600).map((e) => ({ id: String(e.id), source: String(e.source), sourceHandle: e.sourceHandle ?? null, target: String(e.target), targetHandle: e.targetHandle ?? null }));
  return { name: c.name, nodes, edges };
}

export async function generateMetadata(props: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const params = await props.params;
  const r = await load(params.token);
  return { title: r ? `${r.name} · Eclipse canvas` : "Canvas", robots: { index: false, follow: false } };
}

// A canvas shared with a read-only link: the board as its owner left it, with no way to change it.
export default async function SharedCanvas(props: { params: Promise<{ token: string }> }) {
  const params = await props.params;
  const r = await load(params.token);
  if (!r) notFound();
  return (
    <main className="sv">
      <header className="sv-head">
        <b translate="no">{r.name}</b>
        <span>View only</span>
        <Link href="/" className="sv-brand">Made with Eclipse</Link>
      </header>
      <div className="sv-board"><SharedBoard token={params.token} nodes={r.nodes} edges={r.edges} /></div>
    </main>
  );
}
