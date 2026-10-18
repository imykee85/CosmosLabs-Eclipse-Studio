"use client";

import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
import { useClerk, useUser } from "@clerk/nextjs";
import { Upload } from "lucide-react";
import Avatar from "@/components/Avatar";
import { useDemoProfile } from "@/components/account";
import { clerkEnabled } from "@/lib/clerk-enabled";
import { LANGS } from "@/lib/i18n/languages";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { squareDataUrl, writeDemoProfile } from "@/lib/demo-profile";
import { clearAccountData } from "@/lib/clear-account-data";
import DeleteAccount from "./DeleteAccount";

const MAX_BYTES = 15 * 1024 * 1024;
const TYPES = ["image/png", "image/jpeg", "image/webp"];

type Props = {
  name: string;
  image?: string;
  saveName: (name: string) => Promise<void>;
  saveAvatar: (file: File) => Promise<void>;
  deleteAccount: () => Promise<{ ok: boolean; error?: string; notes?: string[] }>;
  leave: () => void;
};

function ProfileForm({ name, image, saveName, saveAvatar, deleteAccount, leave }: Props) {
  const [value, setValue] = useState(name);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const { lang, setLang } = useLocale();
  const file = useRef<HTMLInputElement>(null);

  useEffect(() => setValue(name), [name]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const clean = value.trim();
    if (!clean || clean === name) return;
    setBusy(true);
    setNote(null);
    try {
      await saveName(clean);
      setNote({ ok: true, text: "Saved." });
    } catch (err) {
      setNote({ ok: false, text: err instanceof Error ? err.message : "Could not save. Please try again." });
    } finally {
      setBusy(false);
    }
  }

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!TYPES.includes(f.type)) return setNote({ ok: false, text: "Use a PNG, JPEG or WebP image." });
    if (f.size > MAX_BYTES) return setNote({ ok: false, text: "That image is over 15 MB." });
    setBusy(true);
    setNote(null);
    try {
      await saveAvatar(f);
      setNote({ ok: true, text: "Avatar updated." });
    } catch (err) {
      setNote({ ok: false, text: err instanceof Error ? err.message : "Could not update the avatar." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <section className="st-section" aria-labelledby="st-profile">
        <h2 id="st-profile">Profile details</h2>
        <p className="st-sub">Your name and avatar are shown on your account and in shared links.</p>

        <div className="st-avatar-row">
          <Avatar name={value || name} image={image} className="st-avatar" />
          <div>
            <button type="button" className="st-ghost" disabled={busy} onClick={() => file.current?.click()}><Upload size={15} /> Change avatar</button>
            <p className="st-hint">PNG, JPEG or WebP · max 15 MB</p>
          </div>
          <input ref={file} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={onFile} aria-label="Upload avatar" />
        </div>

        <form onSubmit={submit}>
          <label htmlFor="st-name" className="st-label">FULL NAME</label>
          <input id="st-name" className="st-input" value={value} onChange={(e) => { setValue(e.target.value); setNote(null); }} maxLength={80} autoComplete="name" />
          <div className="st-actions">
            <button type="submit" className="st-save" disabled={busy || !value.trim() || value.trim() === name}>{busy ? "Saving…" : "Save changes"}</button>
            {note && <span className={`st-note ${note.ok ? "is-ok" : "is-err"}`} role={note.ok ? "status" : "alert"}>{note.text}</span>}
          </div>
        </form>
      </section>

      <section className="st-section" aria-labelledby="st-prefs">
        <h2 id="st-prefs">Preferences</h2>
        <p className="st-sub">Choose the language for AI suggestions and the interface.</p>
        <label htmlFor="st-lang" className="st-label">LANGUAGE</label>
        <select id="st-lang" className="st-input st-select" value={lang} onChange={(e) => setLang(e.target.value)} translate="no">
          {LANGS.map((l) => <option key={l.code} value={l.code}>{l.native}</option>)}
        </select>
      </section>

      <DeleteAccount run={deleteAccount} finish={leave} />
    </>
  );
}

function ClerkProfile() {
  const { user } = useUser();
  const { signOut } = useClerk();
  return (
    <ProfileForm
      name={user?.fullName ?? ""}
      image={user?.hasImage ? user.imageUrl : undefined}
      saveName={async (full) => {
        const [first, ...rest] = full.split(/\s+/);
        await user?.update({ firstName: first, lastName: rest.join(" ") });
      }}
      saveAvatar={async (f) => { await user?.setProfileImage({ file: f }); }}
      deleteAccount={async () => {
        const res = await fetch("/api/account/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirm: "DELETE" }) });
        const data = await res.json().catch(() => ({}));
        return res.ok ? { ok: true, notes: Array.isArray(data.notes) ? data.notes : [] } : { ok: false, error: typeof data.error === "string" ? data.error : "Could not delete the account." };
      }}
      leave={() => { clearAccountData(); void signOut({ redirectUrl: "/" }).catch(() => {}).finally(() => { window.location.href = "/"; }); }}
    />
  );
}

function DemoProfileForm() {
  const p = useDemoProfile();
  return (
    <ProfileForm
      name={p.name}
      image={p.avatar}
      saveName={async (n) => writeDemoProfile({ name: n })}
      saveAvatar={async (f) => writeDemoProfile({ avatar: await squareDataUrl(f) })}
      deleteAccount={async () => ({ ok: true })}
      leave={() => {
        // Demo mode keeps everything in this browser: wipe it.
        try { Object.keys(localStorage).filter((k) => k.startsWith("eclipse-")).forEach((k) => localStorage.removeItem(k)); } catch {}
        window.location.href = "/";
      }}
    />
  );
}

export default function ProfilePanel() {
  return clerkEnabled ? <ClerkProfile /> : <DemoProfileForm />;
}
