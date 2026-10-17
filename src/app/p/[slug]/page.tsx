import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { cleanDraft, lines, parseSocials, safeHref } from "@/lib/portfolio";
import "./portfolio-public.css";

export const dynamic = "force-dynamic";

async function load(slug: string) {
  const p = await db.portfolio.findUnique({ where: { slug } }).catch(() => null);
  if (!p || !p.published) return null;
  const d = cleanDraft(p.data);
  const media = d.projectIds.length
    ? await db.generation.findMany({
        where: { userId: p.userId, projectId: { in: d.projectIds }, status: "completed", deletedAt: null, storageKey: { not: null } },
        orderBy: { createdAt: "desc" }, take: 60, select: { id: true, kind: true, width: true, height: true, prompt: true },
      })
    : [];
  return { d, media };
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const r = await load(params.slug);
  if (!r) return { title: "Portfolio", robots: { index: false } };
  return { title: r.d.headline || "Portfolio", description: r.d.tagline || r.d.statement || undefined, openGraph: { title: r.d.headline, description: r.d.tagline || undefined } };
}

// A published portfolio: the person's story and contact details, and the finished pictures and videos of the projects they chose.
export default async function PublicPortfolio({ params }: { params: { slug: string } }) {
  const r = await load(params.slug);
  if (!r) notFound();
  const { d, media } = r;
  const socials = parseSocials(d.socials);
  const services = lines(d.services).slice(0, 12);
  const clients = lines(d.clients).slice(0, 24);
  const website = safeHref(d.website);
  return (
    <main className={`pp pp-${d.theme}`}>
      {d.photos.Cover && <div className="pp-cover" style={{ backgroundImage: `url(${d.photos.Cover})` }} role="img" aria-label="" />}
      <header className="pp-head">
        <h1 translate="no">{d.headline}</h1>
        {d.tagline && <p className="pp-tag" translate="no">{d.tagline}</p>}
        {(d.role || d.location) && <p className="pp-meta" translate="no">{[d.role, d.location].filter(Boolean).join(" · ")}</p>}
        {d.statement && <blockquote translate="no">{d.statement}</blockquote>}
      </header>

      {media.length > 0 && (
        <section className="pp-work" aria-label="Work">
          <h2>Work</h2>
          <ul>
            {media.map((m) => (
              <li key={m.id} style={m.width && m.height ? { aspectRatio: `${m.width} / ${m.height}` } : undefined}>
                {m.kind === "video"
                  ? <video src={`/api/public/p/${params.slug}/${m.id}`} controls playsInline preload="metadata" aria-label={m.prompt.slice(0, 120)} />
                  // eslint-disable-next-line @next/next/no-img-element
                  : <img src={`/api/public/p/${params.slug}/${m.id}`} alt={m.prompt.slice(0, 120)} loading="lazy" />}
              </li>
            ))}
          </ul>
        </section>
      )}

      {(d.about || d.photos.About) && (
        <section className="pp-about">
          <h2>About</h2>
          <div className="pp-about-grid">
            {d.photos.About && <div className="pp-photo" style={{ backgroundImage: `url(${d.photos.About})` }} role="img" aria-label="" />}
            <div translate="no">{d.about.split(/\n\s*\n/).filter(Boolean).map((t, i) => <p key={i}>{t}</p>)}</div>
          </div>
        </section>
      )}

      {services.length > 0 && <section><h2>Services</h2><ul className="pp-list" translate="no">{services.map((s) => <li key={s}>{s}</li>)}</ul></section>}
      {clients.length > 0 && <section><h2>Clients</h2><p translate="no">{clients.join(" · ")}</p></section>}

      {(d.email || d.phone || website || socials.length > 0 || d.photos.Contact) && (
        <section className="pp-contact">
          <h2>Contact</h2>
          <div className="pp-about-grid">
            {d.photos.Contact && <div className="pp-photo" style={{ backgroundImage: `url(${d.photos.Contact})` }} role="img" aria-label="" />}
            <ul className="pp-list" translate="no">
              {d.email && <li><a href={`mailto:${d.email}`}>{d.email}</a></li>}
              {d.phone && <li>{d.phone}</li>}
              {website && <li><a href={website} target="_blank" rel="noopener noreferrer">{d.website}</a></li>}
              {socials.map((s) => <li key={s.name}>{s.href ? <a href={s.href} target="_blank" rel="noopener noreferrer">{s.name}</a> : s.name}</li>)}
            </ul>
          </div>
        </section>
      )}
      <footer className="pp-foot"><a href="/">Made with Eclipse Studio</a></footer>
    </main>
  );
}
