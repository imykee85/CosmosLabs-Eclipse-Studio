/* eslint-disable @next/next/no-img-element -- plain <img> like the rest of the app (the image optimizer is off) */
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import "./create-pick.css";

// The default Create screen: three studios as tall picture cards (owner 2026-10-17: "make it premium, world class"). Each card shows what the studio
// makes (stills, a moving frame, a voice), its number, name and one line; the whole card is the link. Pictures are Eclipse's own sample stills.
const STUDIOS = [
  { href: "/create", n: "01", name: "Image Studio", line: "Campaign-grade stills from a single prompt.", kind: "photo" },
  { href: "/generate", n: "02", name: "Video Studio", line: "Cinematic clips with motion, sound and story.", kind: "video" },
  { href: "/voice", n: "03", name: "Voice Studio", line: "Voices, music and sound, cloned or designed.", kind: "voice" },
] as const;

function Visual({ kind }: { kind: (typeof STUDIOS)[number]["kind"] }) {
  if (kind === "photo") return (
    <div className="cp-stills" aria-hidden="true">
      <img src="/carousel/card-11.jpg" alt="" loading="lazy" decoding="async" />
      <img src="/carousel/card-4-poster.jpg" alt="" loading="lazy" decoding="async" />
      <img src="/carousel/card-6-poster.jpg" alt="" loading="lazy" decoding="async" />
    </div>
  );
  if (kind === "video") return (
    <div className="cp-film" aria-hidden="true">
      <img src="/carousel/card-2-poster.jpg" alt="" loading="lazy" decoding="async" />
      <span className="cp-rec"><i />REC</span>
      <span className="cp-tc">00:00:08:14</span>
      <span className="cp-scrub"><i /></span>
    </div>
  );
  return (
    <div className="cp-voice" aria-hidden="true">
      <span className="cp-orb" />
      <span className="cp-wave">{Array.from({ length: 28 }, (_, i) => <i key={i} style={{ ["--d" as string]: `${(i * 137) % 900}ms`, ["--h" as string]: `${30 + ((i * 53) % 70)}%` }} />)}</span>
    </div>
  );
}

export default function ProjectHome() {
  return (
    <div className="cp">
      <header className="cp-head">
        <span className="cp-eyebrow">Create</span>
        <h1>What are we creating?</h1>
        <p>Choose a studio. Everything you make is saved to your gallery.</p>
      </header>
      <div className="cp-grid">
        {STUDIOS.map((s) => (
          <Link key={s.href} href={s.href} className={`cp-card is-${s.kind}`}>
            <Visual kind={s.kind} />
            <div className="cp-shade" />
            <div className="cp-body">
              <span className="cp-n">{s.n}</span>
              <h2>{s.name}</h2>
              <p>{s.line}</p>
            </div>
            <span className="cp-go"><ArrowUpRight size={20} /></span>
          </Link>
        ))}
      </div>
    </div>
  );
}
