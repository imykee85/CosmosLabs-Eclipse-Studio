"use client";

import { useState } from "react";
import ProfilePanel from "./ProfilePanel";
import "./settings.css";

const TABS = ["Profile", "Billing", "Team", "API"] as const;
type Tab = (typeof TABS)[number];

const SOON: Record<Exclude<Tab, "Profile">, { title: string; copy: string }> = {
  Billing: { title: "Billing", copy: "Plans, credits and invoices will live here." },
  Team: { title: "Team", copy: "Invite teammates and share projects. Coming soon." },
  API: { title: "API", copy: "Create keys to use Eclipse from your own tools. Coming soon." },
};

export default function SettingsView() {
  const [tab, setTab] = useState<Tab>("Profile");

  return (
    <div className="st-wrap">
      <h1>Settings</h1>
      <p className="st-lead">Manage your profile, billing, and team.</p>

      <div className="st-tabs" role="tablist" aria-label="Settings sections">
        {TABS.map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? "is-active" : ""} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>

      <div className="st-card" role="tabpanel">
        {tab === "Profile" ? (
          <ProfilePanel />
        ) : (
          <section className="st-section">
            <h2>{SOON[tab].title}</h2>
            <p className="st-sub">{SOON[tab].copy}</p>
            <p className="st-soon">Coming soon</p>
          </section>
        )}
      </div>
    </div>
  );
}
