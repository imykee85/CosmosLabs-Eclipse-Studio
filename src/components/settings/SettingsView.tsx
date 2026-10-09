"use client";

import { useState } from "react";
import { SETTINGS_TABS as TABS, type SettingsTab as Tab } from "@/lib/settings-tabs";
import ApiPanel from "./ApiPanel";
import BillingPanel from "./BillingPanel";
import ProfilePanel from "./ProfilePanel";
import TeamPanel from "./TeamPanel";
import "./settings.css";

export default function SettingsView({ initialTab = "Profile" }: { initialTab?: Tab }) {
  const [tab, setTab] = useState<Tab>(initialTab);

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
        ) : tab === "Billing" ? (
          <BillingPanel />
        ) : tab === "Team" ? (
          <TeamPanel />
        ) : (
          <ApiPanel />
        )}
      </div>
    </div>
  );
}
