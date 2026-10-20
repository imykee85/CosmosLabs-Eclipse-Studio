"use client";

import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { Lock } from "lucide-react";
import { clerkEnabled } from "@/lib/clerk-enabled";

// What Clerk answers when something is refused, as a plain sentence.
function why(err: unknown, fallback: string): string {
  const e = err as { errors?: { longMessage?: string; message?: string }[]; message?: string };
  return e?.errors?.[0]?.longMessage ?? e?.errors?.[0]?.message ?? (typeof e?.message === "string" && e.message.length < 160 ? e.message : fallback);
}

function Password() {
  const { user } = useUser();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [others, setOthers] = useState(true);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const hasPassword = Boolean(user?.passwordEnabled);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (next.length < 8) { setNote({ ok: false, text: "Use at least 8 characters." }); return; }
    if (next !== again) { setNote({ ok: false, text: "The two new passwords do not match." }); return; }
    setBusy(true); setNote(null);
    try {
      await user.updatePassword({ newPassword: next, ...(hasPassword ? { currentPassword: current } : {}), signOutOfOtherSessions: others });
      setCurrent(""); setNext(""); setAgain("");
      setNote({ ok: true, text: hasPassword ? "Password changed." : "Password set." });
    } catch (err) { setNote({ ok: false, text: why(err, "Could not change the password.") }); }
    setBusy(false);
  }

  return (
    <section className="st-section" aria-labelledby="st-pw">
      <h2 id="st-pw">Security</h2>
      <p className="st-sub">Keep your account safe with a strong password.</p>
      <h3 id="st-pw3" className="st-h3"><Lock size={16} style={{ verticalAlign: "-2px", marginRight: 8 }} />{hasPassword ? "Change password" : "Set a password"}</h3>
      <form className="st-secform" onSubmit={save}>
        {hasPassword && (
          <label><span className="st-label">CURRENT PASSWORD</span>
            <input className="st-input" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required /></label>
        )}
        <label><span className="st-label">NEW PASSWORD</span>
          <input className="st-input" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} required minLength={8} /></label>
        <label><span className="st-label">REPEAT NEW PASSWORD</span>
          <input className="st-input" type="password" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} required minLength={8} /></label>
        <label className="st-check"><input type="checkbox" checked={others} onChange={(e) => setOthers(e.target.checked)} /> Sign me out of my other devices</label>
        <button type="submit" className="st-upgrade st-secsave" disabled={busy}>{busy ? "Saving..." : hasPassword ? "Change password" : "Set password"}</button>
        {note && <p className="st-meta" role={note.ok ? "status" : "alert"} style={{ color: note.ok ? undefined : "#e5484d" }}>{note.text}</p>}
      </form>
    </section>
  );
}

function ClerkSecurity() {
  const { isLoaded, isSignedIn } = useUser();
  if (!isLoaded) return null;
  if (!isSignedIn) return <Gate />;
  return <Password />;
}

function Gate() {
  return (
    <section className="st-section" aria-labelledby="st-pw">
      <h2 id="st-pw">Security</h2>
      <p className="st-sub">Your password needs a signed-in account.</p>
      <div className="st-empty st-gate">
        <Lock size={46} strokeWidth={1.4} />
        <p className="st-empty-title">Sign in to manage security</p>
        <p className="st-meta">Change your password.</p>
      </div>
    </section>
  );
}

export default function SecurityPanel() {
  return clerkEnabled ? <ClerkSecurity /> : <Gate />;
}
