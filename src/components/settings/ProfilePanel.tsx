"use client";

import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { Upload } from "lucide-react";
import Avatar from "@/components/Avatar";
import { useDemoProfile } from "@/components/account";
import { clerkEnabled } from "@/lib/clerk-enabled";
import { squareDataUrl, writeDemoProfile } from "@/lib/demo-profile";

const MAX_BYTES = 15 * 1024 * 1024;
const TYPES = ["image/png", "image/jpeg", "image/webp"];
const LANGS = ["English", "Español", "Français", "Deutsch", "Português"];
const LANG_KEY = "eclipse-language";

type Props = {
  name: string;
  image?: string;
  saveName: (name: string) => Promise<void>;
  saveAvatar: (file: File) => Promise<void>;
};

function ProfileForm({ name, image, saveName, saveAvatar }: Props) {
  const [value, setValue] = useState(name);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [lang, setLang] = useState("English");
  const file = useRef<HTMLInputElement>(null);

  useEffect(() => setValue(name), [name]);
  useEffect(() => {
    try { const l = localStorage.getItem(LANG_KEY); if (l && LANGS.includes(l)) setLang(l); } catch {}
  }, []);

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

  function chooseLang(l: string) {
    setLang(l);
    try { localStorage.setItem(LANG_KEY, l); } catch {}
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
        <select id="st-lang" className="st-input st-select" value={lang} onChange={(e) => chooseLang(e.target.value)}>
          {LANGS.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
        <p className="st-hint">Remembered on this device. The interface is English only for now.</p>
      </section>
    </>
  );
}

function ClerkProfile() {
  const { user } = useUser();
  return (
    <ProfileForm
      name={user?.fullName ?? ""}
      image={user?.hasImage ? user.imageUrl : undefined}
      saveName={async (full) => {
        const [first, ...rest] = full.split(/\s+/);
        await user?.update({ firstName: first, lastName: rest.join(" ") });
      }}
      saveAvatar={async (f) => { await user?.setProfileImage({ file: f }); }}
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
    />
  );
}

export default function ProfilePanel() {
  return clerkEnabled ? <ClerkProfile /> : <DemoProfileForm />;
}
