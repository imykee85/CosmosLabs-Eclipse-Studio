"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import "./subscribe-alert.css";

// The SUBSCRIPTION ALERT (pricing master brief, section 2). When the server refuses a job for lack of credits on an account that is not subscribed it answers
// 402 with code "SUBSCRIBE" and the sentence to show. One place sees every such answer (fetch is wrapped once, the answer is only read from a clone), so
// Image, Video and Audio Studio, Core, Atlas, Treatment and Prompts all show the same dialog with a Subscribe button, whatever each screen does with the error.
declare global { interface Window { __eclipseSubscribeFetch?: boolean } }

export default function SubscribeAlert() {
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (window.__eclipseSubscribeFetch) return;
    window.__eclipseSubscribeFetch = true;
    const original = window.fetch.bind(window);
    window.fetch = async (...args: Parameters<typeof fetch>) => {
      const res = await original(...args);
      if (res.status === 402) {
        res.clone().json().then((d) => { if (d && d.code === "SUBSCRIBE" && typeof d.error === "string") setMessage(d.error); }).catch(() => {});
      }
      return res;
    };
  }, []);

  useEffect(() => {
    if (!message) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setMessage(""); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [message]);

  if (!message) return null;
  return (
    <div className="sa-back" onMouseDown={(e) => { if (e.target === e.currentTarget) setMessage(""); }}>
      <div className="sa-card" role="alertdialog" aria-modal="true" aria-labelledby="sa-title">
        <button type="button" className="sa-x" aria-label="Close" onClick={() => setMessage("")}><X size={16} /></button>
        <h2 id="sa-title">Subscribe to keep creating</h2>
        <p>{message}</p>
        <a className="sa-go" href="/settings?tab=billing">Subscribe</a>
      </div>
    </div>
  );
}
