"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { loadWhop } from "@whop/elements";
import { WhopElements, Checkout, CheckoutElement } from "@whop/elements-react";

const SAFE_ID = /^[A-Za-z0-9_-]{1,80}$/;

/** Payment page on Eclipse's own address. The payment form is the provider's, drawn inside this page. Credits are NEVER granted here:
 * only the verified payment webhook adds them; this page just shows the form and sends the person back to Billing. */
function Inner() {
  const q = useSearchParams();
  const c = q.get("c") ?? "";
  const r = q.get("r") ?? "";
  const f = q.get("f") ?? "";
  const valid = SAFE_ID.test(c);
  const [back, setBack] = useState("/settings?tab=billing");
  const [slow, setSlow] = useState(false);
  const [loading, setLoading] = useState(true);
  const elements = useMemo(() => loadWhop(), []);

  useEffect(() => { if (r.startsWith(`${window.location.origin}/`)) setBack(r); }, [r]);
  useEffect(() => {
    const t = setTimeout(() => setSlow(true), 12000);
    return () => clearTimeout(t);
  }, []);

  let fallback = "";
  try { const u = new URL(f); if (u.protocol === "https:" && /(^|\.)whop\.com$/.test(u.hostname)) fallback = u.toString(); } catch { /* none */ }

  if (!valid) return <div style={{ padding: 32 }}>This payment link is not valid. <a href="/settings?tab=billing">Back to Billing</a></div>;

  return (
    <div style={{ maxWidth: 520, margin: "0 auto", padding: "24px 16px 80px" }}>
      <a href="/settings?tab=billing" style={{ display: "inline-block", marginBottom: 16, fontSize: 15 }}>&lt; Billing</a>
      <WhopElements elements={elements}>
        <Checkout checkoutConfiguration={c} returnUrl={back} onLoadingChange={(l: boolean) => setLoading(l)}>
          <CheckoutElement />
        </Checkout>
      </WhopElements>
      {slow && loading && fallback && (
        <p style={{ marginTop: 16, fontSize: 15 }}>The payment form is taking a while. <a href={fallback}>Open the secure payment page</a></p>
      )}
    </div>
  );
}

export default function CheckoutView() {
  return <Suspense fallback={null}><Inner /></Suspense>;
}
