import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { normalizeCode, type CertFacts } from "@/lib/certificates";
import CertActions from "./CertActions";
import "./cert.css";

export const dynamic = "force-dynamic";

const KIND = { image: "Image", video: "Video", audio: "Audio" } as const;
const fmtBytes = (n: number) => (n < 1024 * 1024 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1024 / 1024).toFixed(2)} MB`);

export async function generateMetadata(props: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const params = await props.params;
  return { title: "Certificate of origin", robots: { index: false, follow: false }, description: `Certificate ${params.code.toUpperCase()}` };
}

// The public page of one certificate. Anyone with the code can read it and check a file against its fingerprint; nothing else about the owner is shown.
export default async function CertificatePage(props: { params: Promise<{ code: string }> }) {
  const params = await props.params;
  const code = normalizeCode(params.code);
  const c = code ? await db.certificate.findUnique({ where: { code } }).catch(() => null) : null;
  if (!c) notFound();
  const f = c.facts as CertFacts;
  const kind = (c.kind in KIND ? c.kind : "image") as keyof typeof KIND;
  const rows: [string, string][] = [
    ["Type", KIND[kind]],
    ["Made with", f.model ?? ""],
    ["Made on", f.madeAt ? new Date(f.madeAt).toUTCString().replace(" GMT", " UTC") : ""],
    ["Dimensions", f.width && f.height ? `${f.width} × ${f.height} px` : ""],
    ["Aspect ratio", f.aspectRatio ?? ""],
    ["Length", f.durationSec ? `${Math.round(f.durationSec * 10) / 10} s` : ""],
    ["Voice", f.voice ?? ""],
    ["File size", c.sizeBytes ? fmtBytes(c.sizeBytes) : ""],
  ].filter((r): r is [string, string] => Boolean(r[1]));
  return (
    <main className="ct">
      <article className="ct-card">
        <header>
          <span className="ct-eyebrow">Eclipse Studio</span>
          <h1>Certificate of origin</h1>
          <p className="ct-code" translate="no">{c.code}</p>
        </header>

        {c.showMedia && (
          <div className="ct-media">
            {kind === "video" ? <video src={`/api/public/cert/${c.code}/media`} controls playsInline preload="metadata" />
              : kind === "audio" ? <audio src={`/api/public/cert/${c.code}/media`} controls preload="none" />
              // eslint-disable-next-line @next/next/no-img-element
              : <img src={`/api/public/cert/${c.code}/media`} alt="" />}
          </div>
        )}

        <p className="ct-lead">This certifies that <b translate="no">{c.creator}</b> made the {KIND[kind].toLowerCase()} described below with Eclipse Studio, and that the file existed in exactly this form when the certificate was issued.</p>

        <dl className="ct-facts">
          <div><dt>Issued</dt><dd>{c.issuedAt.toUTCString().replace(" GMT", " UTC")}</dd></div>
          <div><dt>Creator</dt><dd translate="no">{c.creator}</dd></div>
          {rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd translate="no">{v}</dd></div>)}
          {c.showPrompt && f.prompt && <div className="ct-wide"><dt>{kind === "audio" ? "Script" : "Prompt"}</dt><dd translate="no">{f.prompt}</dd></div>}
          <div className="ct-wide"><dt>File fingerprint (SHA-256)</dt><dd className="ct-hash" translate="no">{c.sha256}</dd></div>
        </dl>

        <CertActions sha256={c.sha256} />

        <p className="ct-fine">A certificate is supporting evidence of when and by whom a file was made on Eclipse Studio. It is not a legal registration of copyright or ownership.</p>
      </article>
    </main>
  );
}
