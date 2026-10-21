import { NextResponse } from "next/server";
import { gateFeature } from "@/lib/access";
import { requireUser } from "@/lib/api-user";
import { db } from "@/lib/db";
import { cleanDraft, slugify, validSlug, type PortfolioDraft } from "@/lib/portfolio";

// The signed-in person's portfolio: the draft, whether it is live, and the finished media of the projects they chose (what the page shows).
async function mediaOf(userId: string, projectIds: string[]) {
  if (!projectIds.length) return [];
  const rows = await db.generation.findMany({
    where: { userId, projectId: { in: projectIds }, status: "completed", deletedAt: null, storageKey: { not: null } },
    orderBy: { createdAt: "desc" }, take: 60, select: { id: true, kind: true, width: true, height: true },
  });
  return rows.map((g) => ({ id: g.id, kind: g.kind === "video" ? "video" : "image", width: g.width, height: g.height }));
}

/** Keeps only projects that are the person's own and not in the bin. */
async function ownProjects(userId: string, ids: string[]): Promise<string[]> {
  if (!ids.length) return [];
  const rows = await db.project.findMany({ where: { userId, id: { in: ids }, deletedAt: null }, select: { id: true } });
  const ok = new Set(rows.map((r) => r.id));
  return ids.filter((i) => ok.has(i));
}

export async function GET() {
  const u = await requireUser();
  if ("fail" in u) return u.fail;
  const p = await db.portfolio.findUnique({ where: { userId: u.userId } });
  const draft = p ? cleanDraft(p.data) : null;
  return NextResponse.json({
    portfolio: p && draft ? { ...draft, slug: p.slug ?? "", published: p.published, publishedAt: p.publishedAt } : null,
    media: draft ? await mediaOf(u.userId, await ownProjects(u.userId, draft.projectIds)) : [],
  });
}

// Saves the draft (and the address). Publishing is a separate step so a half-written page is never live by accident.
export async function PUT(req: Request) {
  const u = await requireUser();
  if ("fail" in u) return u.fail;
  const body = (await req.json().catch(() => null)) as (Partial<PortfolioDraft> & { slug?: unknown }) | null;
  if (!body) return NextResponse.json({ error: "Nothing to save." }, { status: 400 });
  const draft = cleanDraft(body);
  draft.projectIds = await ownProjects(u.userId, draft.projectIds);
  const slug = typeof body.slug === "string" ? slugify(body.slug) : "";
  if (slug) {
    const bad = validSlug(slug);
    if (bad) return NextResponse.json({ error: bad }, { status: 400 });
    const taken = await db.portfolio.findUnique({ where: { slug } });
    if (taken && taken.userId !== u.userId) return NextResponse.json({ error: "That address is taken. Choose another." }, { status: 409 });
  }
  const existing = await db.portfolio.findUnique({ where: { userId: u.userId } });
  try {
    const p = existing
      ? await db.portfolio.update({ where: { userId: u.userId }, data: { data: draft, slug: slug || null, ...(!slug && existing.published ? { published: false } : {}) } })
      : await db.portfolio.create({ data: { userId: u.userId, data: draft, slug: slug || null } });
    return NextResponse.json({ portfolio: { ...draft, slug: p.slug ?? "", published: p.published, publishedAt: p.publishedAt }, media: await mediaOf(u.userId, draft.projectIds) });
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") return NextResponse.json({ error: "That address is taken. Choose another." }, { status: 409 });
    console.error("saving portfolio failed", e);
    return NextResponse.json({ error: "Could not save your portfolio." }, { status: 500 });
  }
}

// Publish puts the saved page live at /p/<address>; unpublish takes it down. Publishing needs an address, a headline and at least one project.
export async function POST(req: Request) {
  const u = await requireUser();
  if ("fail" in u) return u.fail;
  const body = (await req.json().catch(() => null)) as { action?: unknown } | null;
  const p = await db.portfolio.findUnique({ where: { userId: u.userId } });
  if (!p) return NextResponse.json({ error: "Save your draft first." }, { status: 400 });
  if (body?.action === "unpublish") {
    const r = await db.portfolio.update({ where: { userId: u.userId }, data: { published: false } });
    return NextResponse.json({ published: r.published, publishedAt: r.publishedAt });
  }
  if (body?.action !== "publish") return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  const gated = await gateFeature("portfolio"); // taking a page down is always allowed; putting one live is part of the paid plans
  if (gated) return gated;
  const draft = cleanDraft(p.data);
  const bad = p.slug ? validSlug(p.slug) : "Choose an address for your page first.";
  if (bad) return NextResponse.json({ error: bad }, { status: 400 });
  if (!draft.headline.trim()) return NextResponse.json({ error: "Add a headline (your name or studio) first." }, { status: 400 });
  const projects = await ownProjects(u.userId, draft.projectIds);
  if (!projects.length) return NextResponse.json({ error: "Choose at least one project to show." }, { status: 400 });
  const r = await db.portfolio.update({ where: { userId: u.userId }, data: { published: true, publishedAt: p.publishedAt ?? new Date() } });
  return NextResponse.json({ published: r.published, publishedAt: r.publishedAt, slug: r.slug });
}
