import { Users } from "lucide-react";
import { plans } from "@/lib/plans";

// Teams are not built yet: everyone is shown the plan-gated message.
export default function TeamPanel() {
  const top = plans[plans.length - 1].name;
  return (
    <section className="st-section" aria-labelledby="st-team">
      <h2 id="st-team">Team &amp; seats</h2>
      <p className="st-sub">Invite collaborators on the {top} plan.</p>
      <div className="st-empty st-gate">
        <Users size={46} strokeWidth={1.4} />
        <p className="st-empty-title">Team features require the {top} plan</p>
        <p className="st-meta">Upgrade to {top} to invite team members, manage seats, and collaborate.</p>
      </div>
    </section>
  );
}
