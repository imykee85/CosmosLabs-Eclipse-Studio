"use client";

import { useState } from "react";
import ApiPanel from "./ApiPanel";
import BillingPanel from "./BillingPanel";
import ProfilePanel from "./ProfilePanel";
import TeamPanel from "./TeamPanel";
import "./settings.css";

const TABS = ["Profile", "Billing", "Team", "API/MCP"] as const;
type Tab = (typeof TABS)[number];


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
