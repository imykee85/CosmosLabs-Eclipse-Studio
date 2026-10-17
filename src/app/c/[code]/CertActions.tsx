"use client";

import { useRef, useState } from "react";
import { Check, FileSearch, Printer, X } from "lucide-react";

type Result = { state: "idle" } | { state: "busy" } | { state: "same" } | { state: "different" } | { state: "error"; message: string };

async function sha256Hex(file: File): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Check a file against the certificate: its fingerprint is worked out here in the browser, so the file never leaves the device.
export default function CertActions({ sha256 }: { sha256: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [r, setR] = useState<Result>({ state: "idle" });

  async function check(file?: File) {
    if (!file) return;
    setR({ state: "busy" });
    try { setR({ state: (await sha256Hex(file)) === sha256 ? "same" : "different" }); }
    catch { setR({ state: "error", message: "This file is too large to check in the browser." }); }
    if (input.current) input.current.value = "";
  }

  return (
    <div className="ct-actions">
      <button type="button" className="ct-btn ct-btn-main" onClick={() => input.current?.click()} disabled={r.state === "busy"}><FileSearch size={16} />{r.state === "busy" ? "Checking…" : "Check a file"}</button>
      <button type="button" className="ct-btn" onClick={() => window.print()}><Printer size={16} />Print or save as PDF</button>
      <input ref={input} type="file" hidden onChange={(e) => check(e.target.files?.[0])} />
      {r.state === "same" && <p className="ct-result is-ok" role="status"><Check size={16} />This file is identical to the one certified.</p>}
      {r.state === "different" && <p className="ct-result is-bad" role="status"><X size={16} />This file does not match the certificate.</p>}
      {r.state === "error" && <p className="ct-result is-bad" role="status">{r.message}</p>}
    </div>
  );
}
