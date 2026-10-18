"use client";

import { useEffect, useState } from "react";
import { OrganizationProfile, OrganizationSwitcher, useOrganization } from "@clerk/nextjs";
import { Users } from "lucide-react";
import { clerkEnabled } from "@/lib/clerk-enabled";

// A team is a shared workspace: everyone in it uses the same credits, projects, Library and files. Teams are Clerk organizations; the person
// switches between their personal workspace and a team here. The members list and invitations are Clerk's own screens.
function ClerkTeam() {
  const { organization, membership, isLoaded } = useOrganization();
  const [light, setLight] = useState(false);
  useEffect(() => { setLight(document.documentElement.getAttribute("data-app-theme") === "light"); }, []);
  const dark = {
    colorBackground: "#161616", colorText: "#f5f5f5", colorTextSecondary: "#a3a3a3", colorInputBackground: "#0f0f0f", colorInputText: "#f5f5f5",
    colorNeutral: "#f5f5f5", colorPrimary: "#c00707", colorDanger: "#e5484d",
  };
  const appearance = {
    variables: light ? { colorPrimary: "#c00707" } : dark,
    elements: { rootBox: { width: "100%" }, cardBox: { width: "100%", boxShadow: "none", border: "1px solid var(--a-line2)" } },
  };
  const isAdmin = membership?.role === "org:admin";

  return (
    <>
      <section className="st-section" aria-labelledby="st-team">
        <h2 id="st-team">Team</h2>
        <p className="st-sub">Work together in a shared workspace. Everyone in a team uses the same credits, projects and Library.</p>

        <label className="st-label">WORKSPACE</label>
        <OrganizationSwitcher
          hidePersonal={false}
          afterSelectOrganizationUrl="/dashboard"
          afterSelectPersonalUrl="/dashboard"
          afterCreateOrganizationUrl="/settings?tab=team"
          appearance={appearance}
        />
        {isLoaded && (
          <p className="st-meta" style={{ marginTop: 12 }} role="status">
            {organization ? `You are working in the team "${organization.name}"${isAdmin ? " as an admin" : ""}.` : "You are working in your personal workspace."}
          </p>
        )}

        <div className="st-teamgrid">
          <div>
            <p className="st-eyebrow">SHARED IN A TEAM</p>
            <ul className="st-teamlist">
              <li>Credits: one balance for the whole team</li>
              <li>Projects, Gallery and the Library</li>
              <li>Uploads, voice takes and canvases</li>
              <li>Billing is handled by team admins</li>
            </ul>
          </div>
          <div>
            <p className="st-eyebrow">STAYS PERSONAL</p>
            <ul className="st-teamlist">
              <li>Core chats, memory and connected apps</li>
              <li>API keys, portfolio and certificates</li>
              <li>Your profile and account</li>
            </ul>
          </div>
        </div>
      </section>

      {organization && (
        <section className="st-section" aria-labelledby="st-members">
          <h3 id="st-members" className="st-h3">Members</h3>
          <OrganizationProfile routing="hash" appearance={appearance} />
        </section>
      )}
    </>
  );
}

export default function TeamPanel() {
  if (clerkEnabled) return <ClerkTeam />;
  return (
    <section className="st-section" aria-labelledby="st-team">
      <h2 id="st-team">Team</h2>
      <p className="st-sub">Teams need a signed-in account.</p>
      <div className="st-empty st-gate">
        <Users size={46} strokeWidth={1.4} />
        <p className="st-empty-title">Sign in to create a team</p>
        <p className="st-meta">Teams share credits, projects and the Library between their members.</p>
      </div>
    </section>
  );
}
