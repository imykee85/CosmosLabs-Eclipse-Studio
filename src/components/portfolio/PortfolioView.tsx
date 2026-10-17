"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Copy, ExternalLink, Link2, Moon, Monitor, Radio, Smartphone, Sun, Upload } from "lucide-react";
import { listProjects, type Project } from "@/lib/projects";
import "./portfolio.css";

// The draft is saved to the account as you type (and kept in this browser as a copy); Publish puts it live at /p/<address>.
const KEY = "eclipse-portfolio";
const SLOTS = ["Cover", "About", "Contact"] as const;

type Draft = {
  headline: string; tagline: string; theme: "dark" | "light"; slug: string; projectIds: string[];
  role: string; location: string; statement: string; about: string;
  email: string; phone: string; website: string; socials: string; services: string; clients: string;
  photos: Record<string, string>;
};

const EMPTY: Draft = {
  headline: "", tagline: "", theme: "dark", slug: "", projectIds: [],
  role: "", location: "", statement: "", about: "",
  email: "", phone: "", website: "", socials: "", services: "", clients: "", photos: {},
};

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);

function shrink(file: File, max = 640): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext("2d")?.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL("image/jpeg", 0.8));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("That image could not be read.")); };
    img.src = url;
  });
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="pf-field"><span>{label}</span>{children}</label>;
}

type Media = { id: string; kind: "image" | "video"; width: number | null; height: number | null };
type ServerPortfolio = Draft & { slug: string; published: boolean };

export default function PortfolioView() {
  const [d, setD] = useState<Draft>(EMPTY);
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [slot, setSlot] = useState<(typeof SLOTS)[number]>("Cover");
  const [device, setDevice] = useState<"desktop" | "phone">("desktop");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [media, setMedia] = useState<Media[]>([]);
  const [published, setPublished] = useState(false);
  const [online, setOnline] = useState<boolean | null>(null); // null while checking; false in preview mode (no sign-in): the draft stays on this device
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const dirty = useRef(false);
  const saving = useRef<Promise<boolean> | null>(null);

  useEffect(() => {
    let local: Draft | null = null;
    try { const s = localStorage.getItem(KEY); if (s) local = { ...EMPTY, ...JSON.parse(s) }; } catch {}
    if (local) setD(local);
    listProjects().then((l) => setProjects(l.filter((p) => !p.deletedAt))).catch(() => setProjects([]));
    fetch("/api/portfolio").then(async (res) => {
      if (!res.ok) { setOnline(false); return; }
      const data = (await res.json()) as { portfolio: ServerPortfolio | null; media: Media[] };
      setOnline(true); setMedia(data.media);
      if (data.portfolio) { const { published: pub, ...rest } = data.portfolio; setD({ ...EMPTY, ...rest }); setPublished(pub); }
      else if (local) dirty.current = true; // a draft made on this device before: send it up
    }).catch(() => setOnline(false));
  }, []);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => { dirty.current = true; setD((p) => ({ ...p, [k]: v })); setNote(""); setError(""); };
  const slug = d.slug || slugify(d.headline) || "your-name";
  // Read after mount: the server has no address, and reading it during render made the page mismatch on load.
  const [host, setHost] = useState("");
  useEffect(() => setHost(window.location.host), []);

  const dRef = useRef(d); dRef.current = d;
  // One save at a time; the latest draft always wins. Returns whether it reached the account.
  const save = useCallback(async (): Promise<boolean> => {
    try { localStorage.setItem(KEY, JSON.stringify(dRef.current)); } catch { setError("Could not keep a copy on this device. Try removing a photo."); }
    if (!online) return false;
    if (saving.current) await saving.current;
    const run = (async () => {
      dirty.current = false;
      const body = { ...dRef.current, slug: dRef.current.slug || slugify(dRef.current.headline) };
      const res = await fetch("/api/portfolio", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error ?? "Could not save your portfolio."); dirty.current = true; return false; }
      setMedia(data.media ?? []);
      setPublished(Boolean(data.portfolio?.published));
      if (data.portfolio?.slug && data.portfolio.slug !== dRef.current.slug) setD((p) => ({ ...p, slug: data.portfolio.slug }));
      return true;
    })();
    saving.current = run;
    try { return await run; } finally { saving.current = null; }
  }, [online]);

  // Autosave a moment after the last change.
  useEffect(() => {
    if (!online || !dirty.current) return;
    const t = setTimeout(() => { void save().then((ok) => { if (ok) setNote("Saved."); }); }, 900);
    return () => clearTimeout(t);
  }, [d, online, save]);

  async function saveNow() {
    setError("");
    const ok = await save();
    setNote(ok ? "Saved." : online ? "" : "Draft saved on this device.");
  }

  const url = host ? `${window.location.protocol}//${host}/p/${slug}` : "";
  async function publish() {
    if (!online) { setError("Publishing needs a signed-in account."); return; }
    setBusy(true); setError(""); setNote("");
    try {
      if (!(await save())) return;
      const res = await fetch("/api/portfolio", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "publish" }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error ?? "Could not publish."); return; }
      setPublished(true); setNote("Your page is live.");
    } finally { setBusy(false); }
  }
  async function unpublish() {
    setBusy(true); setError(""); setNote("");
    try {
      const res = await fetch("/api/portfolio", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "unpublish" }) });
      if (!res.ok) { setError("Could not take the page down."); return; }
      setPublished(false); setNote("Your page is no longer public.");
    } finally { setBusy(false); }
  }
  async function copyLink() {
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { setError("Could not copy. Select the address and copy it by hand."); }
  }

  async function pick(file?: File) {
    if (!file) return;
    try { set("photos", { ...d.photos, [slot]: await shrink(file) }); } catch (e) { setError(e instanceof Error ? e.message : "Upload failed."); }
    if (fileRef.current) fileRef.current.value = "";
  }

  const chosen = (projects ?? []).filter((p) => d.projectIds.includes(p.id));
  const lines = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean);

  return (
    <div className="ws-ing pf">
      <h1>Portfolio</h1>
      <p>Pick your projects. The page builds itself from your finished media and lives at a link you can send anyone.</p>

      <div className="pf-grid">
        <div className="pf-form">
          <section className="pf-card pf-publish">
            <div className="pf-status"><Radio size={14} aria-hidden="true" /> {published ? "Live" : "Draft · not published"}</div>
            <div className="pf-url"><Link2 size={15} aria-hidden="true" /><span>{host}/p/</span>
              <input value={d.slug} onChange={(e) => set("slug", slugify(e.target.value))} placeholder={slug} aria-label="Page address" />
              {d.slug.length > 2 && <Check size={16} className="pf-ok" aria-hidden="true" />}
            </div>
            <div className="pf-actions">
              <button type="button" className="pf-ghost" onClick={copyLink} disabled={!published}>{copied ? <Check size={15} /> : <Copy size={15} />} {copied ? "Copied" : "Copy link"}</button>
              {published && <a className="pf-ghost" href={`/p/${slug}`} target="_blank" rel="noreferrer"><ExternalLink size={15} /> View</a>}
              <button type="button" className="pf-outline" onClick={saveNow}>Save draft</button>
              {published
                ? <button type="button" className="pf-outline" onClick={unpublish} disabled={busy}>Unpublish</button>
                : null}
              <button type="button" className="pf-primary" onClick={publish} disabled={busy}>{published ? "Update page" : "Publish"}</button>
            </div>
            {error ? <small role="alert" style={{ color: "#c00707" }}>{error}</small> : <small>{note || (online === false ? "Your draft is saved on this device. Sign in to publish." : "Your draft saves as you type.")}</small>}
          </section>

          <section className="pf-card">
            <h2><b>1</b> About you</h2>
            <Field label="HEADLINE"><input value={d.headline} onChange={(e) => set("headline", e.target.value)} placeholder="Your name or studio" /></Field>
            <Field label="ONE LINE ABOUT YOU"><input value={d.tagline} onChange={(e) => set("tagline", e.target.value)} placeholder="Product visuals and short ads for modern brands" /></Field>
            <div className="pf-theme"><span>PAGE THEME</span>
              <div role="group" aria-label="Page theme">
                <button type="button" className={d.theme === "dark" ? "is-active" : ""} onClick={() => set("theme", "dark")}><Moon size={14} /> Dark</button>
                <button type="button" className={d.theme === "light" ? "is-active" : ""} onClick={() => set("theme", "light")}><Sun size={14} /> Light</button>
              </div>
            </div>
          </section>

          <section className="pf-card">
            <h2><b>2</b> Projects on the page</h2>
            {projects === null ? <p className="pf-muted">Loading your projects...</p>
              : projects.length === 0 ? <p className="pf-muted">Finish a project first. A portfolio is built from your renders.</p>
              : (
                <ul className="pf-projects">
                  {projects.map((p) => (
                    <li key={p.id}>
                      <label>
                        <input type="checkbox" checked={d.projectIds.includes(p.id)}
                          onChange={(e) => set("projectIds", e.target.checked ? [...d.projectIds, p.id] : d.projectIds.filter((x) => x !== p.id))} />
                        <span>{p.name}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
          </section>

          <section className="pf-card">
            <h2>Your story</h2>
            <p className="pf-muted">Who you are and how to reach you.</p>
            <Field label="Role"><input value={d.role} onChange={(e) => set("role", e.target.value)} placeholder="AI creative director" /></Field>
            <Field label="Location"><input value={d.location} onChange={(e) => set("location", e.target.value)} placeholder="City · Worldwide" /></Field>
            <Field label="Statement"><input value={d.statement} onChange={(e) => set("statement", e.target.value)} placeholder="I turn ideas into images people remember" /></Field>
            <Field label="About you"><textarea rows={5} value={d.about} onChange={(e) => set("about", e.target.value)} placeholder="A couple of paragraphs. A blank line starts a new one." /></Field>

            <div className="pf-field"><span>Photos: pick a slot, then a picture</span>
              <div className="pf-slots">
                {SLOTS.map((s) => (
                  <button key={s} type="button" className={`pf-slot ${slot === s ? "is-active" : ""}`} onClick={() => setSlot(s)} aria-pressed={slot === s}>
                    <span className="pf-slot-img" style={d.photos[s] ? { backgroundImage: `url(${d.photos[s]})` } : undefined} />
                    {s}
                  </button>
                ))}
              </div>
              <button type="button" className="pf-upload" aria-label={`Upload a photo for ${slot}`} onClick={() => fileRef.current?.click()}><Upload size={17} /></button>
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => pick(e.target.files?.[0])} />
            </div>

            <Field label="E-mail"><input type="email" value={d.email} onChange={(e) => set("email", e.target.value)} placeholder="you@studio.com" /></Field>
            <Field label="Phone"><input value={d.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+1 212 555 0150" /></Field>
            <Field label="Website"><input value={d.website} onChange={(e) => set("website", e.target.value)} placeholder="studio.com" /></Field>
            <Field label="Socials, one per line: Name | link"><textarea rows={3} value={d.socials} onChange={(e) => set("socials", e.target.value)} placeholder={"Instagram | instagram.com/you\nLinkedIn | linkedin.com/in/you"} /></Field>
            <Field label="Services, one per line: Title - what it is"><textarea rows={3} value={d.services} onChange={(e) => set("services", e.target.value)} placeholder="Product shots - clean stills for stores and ads" /></Field>
            <Field label="Clients, one per line"><textarea rows={3} value={d.clients} onChange={(e) => set("clients", e.target.value)} placeholder={"Brand one\nBrand two"} /></Field>
          </section>
        </div>

        <aside className="pf-preview" aria-label="Page preview">
          <div className="pf-chrome">
            <i style={{ background: "#ef7b72" }} /><i style={{ background: "#f0c24b" }} /><i style={{ background: "#5bc65f" }} />
            <span className="pf-chrome-url">{host}/p/{slug}</span>
            <div className="pf-device" role="group" aria-label="Preview size">
              <button type="button" className={device === "desktop" ? "is-active" : ""} aria-label="Desktop preview" onClick={() => setDevice("desktop")}><Monitor size={15} /></button>
              <button type="button" className={device === "phone" ? "is-active" : ""} aria-label="Phone preview" onClick={() => setDevice("phone")}><Smartphone size={15} /></button>
            </div>
          </div>
          <div className="pf-stage">
            {chosen.length === 0 && !d.headline ? (
              <div className="pf-placeholder"><h3>Your page appears here</h3><p>Pick a project and fill in your details. The page fills as you go.</p></div>
            ) : (
              <div className={`pf-site pf-site-${d.theme} ${device === "phone" ? "is-phone" : ""}`}>
                {d.photos.Cover && <div className="pf-site-cover" style={{ backgroundImage: `url(${d.photos.Cover})` }} />}
                <h3>{d.headline || "Your name"}</h3>
                {d.tagline && <p className="pf-site-tag">{d.tagline}</p>}
                {(d.role || d.location) && <p className="pf-site-meta">{[d.role, d.location].filter(Boolean).join(" · ")}</p>}
                {d.statement && <blockquote>{d.statement}</blockquote>}
                {media.length > 0 ? <><h4>Work</h4><div className="pf-site-work">{media.slice(0, 12).map((m) => (m.kind === "video"
                  ? <video key={m.id} src={`/api/generations/${m.id}/file`} muted playsInline preload="metadata" />
                  // eslint-disable-next-line @next/next/no-img-element
                  : <img key={m.id} src={`/api/generations/${m.id}/file`} alt="" loading="lazy" />))}</div></>
                  : chosen.length > 0 && <><h4>Projects</h4><ul>{chosen.map((p) => <li key={p.id}>{p.name}</li>)}</ul></>}
                {d.about && <><h4>About</h4>{d.about.split(/\n\s*\n/).map((t, i) => <p key={i}>{t}</p>)}</>}
                {lines(d.services).length > 0 && <><h4>Services</h4><ul>{lines(d.services).map((s) => <li key={s}>{s}</li>)}</ul></>}
                {lines(d.clients).length > 0 && <><h4>Clients</h4><p>{lines(d.clients).join(" · ")}</p></>}
                {(d.email || d.phone || d.website) && <><h4>Contact</h4><p>{[d.email, d.phone, d.website].filter(Boolean).join(" · ")}</p></>}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
