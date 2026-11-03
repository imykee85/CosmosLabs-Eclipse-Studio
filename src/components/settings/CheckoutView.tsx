"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

const LOADER = "https://js.whop.com/static/checkout/loader.js";
const SAFE_ID = /^[A-Za-z0-9_-]{1,80}$/;

/** Payment page on Eclipse's own address. The payment form itself is the payment provider's, shown inside this page. */
function Inner() {
  const q = useSearchParams();
  const c = q.get("c") ?? "";
  const p = q.get("p") ?? "";
  const r = q.get("r") ?? "";
  const f = q.get("f") ?? "";
  const valid = SAFE_ID.test(c) && SAFE_ID.test(p);
  const [back, setBack] = useState("/settings?tab=billing");
  const [slow, setSlow] = useState(false);

  useEffect(() => { if (r.startsWith(`${window.location.origin}/`)) setBack(r); }, [r]);

  useEffect(() => {
    if (!valid) return;
    const s = document.createElement("script");
    s.src = LOADER;
    s.async = true;
    document.head.appendChild(s);
    // If the form has not appeared after a while, offer the provider's own page instead of leaving the person stuck.
    const t = setTimeout(() => { if (!document.querySelector("[data-whop-checkout-plan-id] iframe")) setSlow(true); }, 9000);
    return () => { clearTimeout(t); s.remove(); };
  }, [valid]);

  let fallback = "";
  try { const u = new URL(f); if (u.protocol === "https:" && /(^|\.)whop\.com$/.test(u.hostname)) fallback = u.toString(); } catch { /* none */ }

  if (!valid) return <div style={{ padding: 32 }}>This payment link is not valid. <a href="/settings?tab=billing">Back to Billing</a></div>;

  return (
    <div style={{ maxWidth: 520, margin: "0 auto", padding: "24px 16px 80px" }}>
      <a href="/settings?tab=billing" style={{ display: "inline-block", marginBottom: 16, fontSize: 15 }}>&lt; Billing</a>
      <div
        data-whop-checkout-plan-id={p}
        data-whop-checkout-session={c}
        data-whop-checkout-return-url={back}
        data-whop-checkout-theme="dark"
        style={{ minHeight: 420 }}
      />
      {slow && fallback && (
        <p style={{ marginTop: 16, fontSize: 15 }}>The payment form is taking a while. <a href={fallback}>Open the secure payment page</a></p>
      )}
    </div>
  );
}

export default function CheckoutView() {
  return <Suspense fallback={null}><Inner /></Suspense>;
}
