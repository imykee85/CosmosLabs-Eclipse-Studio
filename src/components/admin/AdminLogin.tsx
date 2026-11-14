"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";

export default function AdminLogin() {
  const router = useRouter();
  const [pw, setPw] = useState(""), [err, setErr] = useState(""), [busy, setBusy] = useState(false);
  async function go(e: React.FormEvent) {
    e.preventDefault(); if (busy || !pw) return;
    setBusy(true); setErr("");
    const r = await fetch("/api/admin/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: pw }) }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    setBusy(false);
    if (r?.ok) { router.replace("/admin"); router.refresh(); return; }
    setErr(j.error ?? "Could not check the password. Try again.");
  }
  return (
    <form className="ad-login" onSubmit={go}>
      <Lock size={22} aria-hidden="true" />
      <h1>Admin</h1>
      <p className="app-muted">Enter the admin password to continue.</p>
      <input type="password" autoComplete="current-password" autoFocus value={pw} onChange={(e) => setPw(e.target.value)} aria-label="Admin password" placeholder="Password" />
      {err && <p className="ad-err" role="alert">{err}</p>}
      <button type="submit" disabled={busy || !pw}>Unlock</button>
    </form>
  );
}
