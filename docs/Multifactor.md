# Multifactor (two-step sign-in): shelved, kept for the future

The owner decided on 2026-10-20 to drop two-step sign-in from the app for now: email verification is enough until Eclipse handles anything that needs more. This note keeps everything needed to bring it back. Nothing here is live.

## What was removed from the app
- Settings > Security used to have a "Two-step sign-in" section under "Change password" with two options:
  1. Authenticator app (marked Recommended): `user.createTOTP()` gave a key and an otpauth address, the QR picture was drawn in the browser by the `qrcode` package, `user.verifyTOTP({code})` turned it on and returned backup codes (shown once), `user.disableTOTP()` turned it off (two taps).
  2. Text message: `user.createPhoneNumber({phoneNumber})`, `phone.prepareVerification()`, `phone.attemptVerification({code})`, then `phone.setReservedForSecondFactor({reserved: true})`; resend, cancel and remove (two taps) were included. Several numbers were allowed.
- The `qrcode` and `@types/qrcode` packages were removed from `package.json` (install them again: `npm i qrcode` and `npm i -D @types/qrcode`).
- The full original component, with the Authenticator and TextMessage pieces, is the code block at the bottom of this note. To restore: copy it over `src/components/settings/SecurityPanel.tsx`, install `qrcode`, run `npm run i18n:extract`, and update the wording tests.

## What was NOT removed (still in the app, on purpose)
- `src/components/auth/ClerkAuth.tsx` still handles the "one more step" code screen at sign-in. It is needed even without two-step: Clerk's new-device check (`needs_client_trust`) emails a code, and that is the email verification the owner is relying on. The same screen also knows how to ask for a text code or an authenticator code (`needs_second_factor`, strategies `phone_code` and `totp`), so when two-step comes back nothing changes at sign-in.

## Clerk dashboard settings (Production instance)
- Configure, User & authentication, Multi-factor: Authenticator application, SMS verification code, Backup codes. These were never switched on, and they stay off. Turn them on again (and allow the SMS countries you need) before bringing the Security section back; without them Clerk refuses the calls.
- Keep "Client Trust" (the new-device email code) on: that is the email verification.

## How to bring it back
1. Switch the three Clerk options on (above).
2. Restore the component from the code below, reinstall `qrcode`.
3. Update the Security copy ("Keep your account safe: a strong password and a second step at sign-in" and the signed-out card).
4. `npm run i18n:extract`, `npm test`, `npm run lint`.
5. Test live once: turn the authenticator on, sign out, sign in with the code; add a phone number and sign in with the text.

NOT verified with a real Clerk session (the sandbox has none): the flows were type-checked against Clerk's types and the tab was browser-tested signed out only.

## The original component

```tsx
"use client";

import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import QRCode from "qrcode";
import { Copy, Lock, ShieldCheck, Smartphone, Trash2 } from "lucide-react";
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
      <p className="st-sub">Keep your account safe: a strong password and a second step at sign-in.</p>
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

function Authenticator() {
  const { user } = useUser();
  const [setup, setSetup] = useState<{ secret: string; uri: string; qr: string } | null>(null);
  const [code, setCode] = useState("");
  const [codes, setCodes] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmOff, setConfirmOff] = useState(false);
  const [error, setError] = useState("");
  const on = Boolean(user?.totpEnabled);

  async function start() {
    if (!user) return;
    setBusy(true); setError("");
    try {
      const t = await user.createTOTP();
      if (!t.uri || !t.secret) throw new Error("No key");
      setSetup({ secret: t.secret, uri: t.uri, qr: await QRCode.toDataURL(t.uri, { margin: 1, width: 220 }) });
    } catch (err) { setError(why(err, "Could not start the setup.")); }
    setBusy(false);
  }
  async function verify(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setBusy(true); setError("");
    try {
      const t = await user.verifyTOTP({ code: code.trim() });
      setSetup(null); setCode("");
      if (t.backupCodes?.length) setCodes(t.backupCodes);
      await user.reload();
    } catch (err) { setError(why(err, "That code did not match. Try the newest one.")); }
    setBusy(false);
  }
  async function off() {
    if (!user) return;
    if (!confirmOff) { setConfirmOff(true); return; }
    setBusy(true); setError("");
    try { await user.disableTOTP(); setConfirmOff(false); await user.reload(); }
    catch (err) { setError(why(err, "Could not turn it off.")); }
    setBusy(false);
  }

  return (
    <div className="st-factor">
      <div className="st-factorhead">
        <ShieldCheck size={22} aria-hidden="true" />
        <div>
          <b>Authenticator app <span className="st-pill">Recommended</span></b>
          <p className="st-meta">Use Google Authenticator or a similar app to make a new 6-digit code every 30 seconds.</p>
        </div>
        {on && !setup && <span className="st-pill st-on">On</span>}
      </div>
      {!on && !setup && <button type="button" className="st-upgrade st-secsave" onClick={start} disabled={busy}>{busy ? "Preparing..." : "Set up"}</button>}
      {setup && (
        <form className="st-setup" onSubmit={verify}>
          <p className="st-meta">1. Open your authenticator app and scan this picture, or enter the key by hand.</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="st-qr" src={setup.qr} alt="QR code for your authenticator app" width={220} height={220} />
          <p className="st-keyline"><code translate="no">{setup.secret}</code>
            <button type="button" className="st-linkbtn" onClick={() => void navigator.clipboard?.writeText(setup.secret)}><Copy size={13} /> Copy</button></p>
          <p className="st-meta"><a className="st-linkbtn" href={setup.uri}>Open in my authenticator app</a></p>
          <p className="st-meta">2. Enter the 6-digit code it shows.</p>
          <input className="st-input st-codeinput" inputMode="numeric" autoComplete="one-time-code" aria-label="6-digit code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
          <div className="st-row">
            <button type="submit" className="st-upgrade st-secsave" disabled={busy || code.length !== 6}>{busy ? "Checking..." : "Turn on"}</button>
            <button type="button" className="st-linkbtn" onClick={() => { setSetup(null); setCode(""); }}>Cancel</button>
          </div>
        </form>
      )}
      {on && !setup && (
        <button type="button" className={`st-removecard ${confirmOff ? "is-confirm" : ""}`} onClick={off} disabled={busy}>{confirmOff ? "Turn off?" : "Turn off"}</button>
      )}
      {codes && (
        <div className="st-backup" role="status">
          <p className="st-meta"><b>Save these backup codes.</b> Each works once if you lose your phone. They are shown only now.</p>
          <ul>{codes.map((c) => <li key={c}><code translate="no">{c}</code></li>)}</ul>
          <button type="button" className="st-linkbtn" onClick={() => void navigator.clipboard?.writeText(codes.join("\n"))}><Copy size={13} /> Copy all</button>
          <button type="button" className="st-linkbtn" onClick={() => setCodes(null)}>I have saved them</button>
        </div>
      )}
      {error && <p className="st-meta" role="alert" style={{ color: "#e5484d" }}>{error}</p>}
    </div>
  );
}

function TextMessage() {
  const { user } = useUser();
  const [number, setNumber] = useState("");
  const [pending, setPending] = useState<string | null>(null); // id of the number waiting for its code
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const phones = (user?.phoneNumbers ?? []).filter((p) => p.verification?.status === "verified" && p.reservedForSecondFactor);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setBusy("add"); setError("");
    try {
      const p = await user.createPhoneNumber({ phoneNumber: number.trim() });
      await p.prepareVerification();
      setPending(p.id);
    } catch (err) { setError(why(err, "Could not send the code. Use the full number with its country code, like +233 24 123 4567.")); }
    setBusy("");
  }
  async function confirmCode(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !pending) return;
    setBusy("code"); setError("");
    try {
      const p = user.phoneNumbers.find((x) => x.id === pending);
      if (!p) throw new Error("gone");
      await p.attemptVerification({ code: code.trim() });
      await p.setReservedForSecondFactor({ reserved: true });
      setPending(null); setCode(""); setNumber("");
      await user.reload();
    } catch (err) { setError(why(err, "That code did not match.")); }
    setBusy("");
  }
  async function resend() {
    const p = user?.phoneNumbers.find((x) => x.id === pending);
    if (!p) return;
    setBusy("resend"); setError("");
    try { await p.prepareVerification(); } catch (err) { setError(why(err, "Could not send a new code.")); }
    setBusy("");
  }
  async function remove(id: string) {
    if (confirm !== id) { setConfirm(id); return; }
    setBusy(id); setError(""); setConfirm("");
    try { await user?.phoneNumbers.find((x) => x.id === id)?.destroy(); await user?.reload(); }
    catch (err) { setError(why(err, "Could not remove the number.")); }
    setBusy("");
  }
  async function cancel() {
    const p = user?.phoneNumbers.find((x) => x.id === pending);
    setPending(null); setCode("");
    try { await p?.destroy(); } catch { /* an unverified number that could not be removed is harmless */ }
  }

  return (
    <div className="st-factor">
      <div className="st-factorhead">
        <Smartphone size={22} aria-hidden="true" />
        <div>
          <b>Text message</b>
          <p className="st-meta">We text a 6-digit code to your phone each time you sign in.</p>
        </div>
      </div>
      {phones.length > 0 && (
        <ul className="st-cardlist">
          {phones.map((p) => (
            <li key={p.id} className="st-cardrow">
              <Smartphone size={18} aria-hidden="true" />
              <div className="st-cardinfo"><b translate="no">{p.phoneNumber}</b></div>
              <button type="button" className={`st-removecard ${confirm === p.id ? "is-confirm" : ""}`} aria-label={`Remove ${p.phoneNumber}`} disabled={busy === p.id} onClick={() => void remove(p.id)}>
                <Trash2 size={15} />{confirm === p.id ? " Remove?" : ""}
              </button>
            </li>
          ))}
        </ul>
      )}
      {pending ? (
        <form className="st-setup" onSubmit={confirmCode}>
          <p className="st-meta">We texted a code to {number}. Enter it here.</p>
          <input className="st-input st-codeinput" inputMode="numeric" autoComplete="one-time-code" aria-label="6-digit code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
          <div className="st-row">
            <button type="submit" className="st-upgrade st-secsave" disabled={busy === "code" || code.length !== 6}>{busy === "code" ? "Checking..." : "Confirm"}</button>
            <button type="button" className="st-linkbtn" onClick={resend} disabled={busy === "resend"}>Send again</button>
            <button type="button" className="st-linkbtn" onClick={cancel}>Cancel</button>
          </div>
        </form>
      ) : (
        <form className="st-setup" onSubmit={add}>
          <label><span className="st-label">{phones.length ? "ADD ANOTHER NUMBER" : "PHONE NUMBER"}</span>
            <input className="st-input" type="tel" inputMode="tel" autoComplete="tel" placeholder="+233 24 123 4567" value={number} onChange={(e) => setNumber(e.target.value)} translate="no" /></label>
          <button type="submit" className="st-upgrade st-secsave" disabled={busy === "add" || number.trim().length < 6}>{busy === "add" ? "Sending..." : "Send code"}</button>
        </form>
      )}
      {error && <p className="st-meta" role="alert" style={{ color: "#e5484d" }}>{error}</p>}
    </div>
  );
}

function ClerkSecurity() {
  const { isLoaded, isSignedIn } = useUser();
  if (!isLoaded) return null;
  if (!isSignedIn) return <Gate />;
  return (
    <>
      <Password />
      <section className="st-section" aria-labelledby="st-2fa">
        <h3 id="st-2fa" className="st-h3"><ShieldCheck size={16} style={{ verticalAlign: "-2px", marginRight: 8 }} />Two-step sign-in</h3>
        <p className="st-sub">After your password, we ask for a second code. Choose how you get it. You can use both.</p>
        <Authenticator />
        <TextMessage />
      </section>
    </>
  );
}

function Gate() {
  return (
    <section className="st-section" aria-labelledby="st-pw">
      <h2 id="st-pw">Security</h2>
      <p className="st-sub">Password and two-step sign-in need a signed-in account.</p>
      <div className="st-empty st-gate">
        <Lock size={46} strokeWidth={1.4} />
        <p className="st-empty-title">Sign in to manage security</p>
        <p className="st-meta">Change your password and turn on a second sign-in step.</p>
      </div>
    </section>
  );
}

export default function SecurityPanel() {
  return clerkEnabled ? <ClerkSecurity /> : <Gate />;
}
```
