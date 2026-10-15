"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { LogoMark } from "@/components/Logo";
import { questions, type QuestionId } from "@/lib/onboarding";
import "./onboarding.css";

export default function OnboardingFlow() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Partial<Record<QuestionId, string | string[]>>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // "form" -> card fades out -> "video" welcome playback -> dashboard
  const [stage, setStage] = useState<"form" | "video">("form");
  const [videoFailed, setVideoFailed] = useState(false);
  const left = useRef(false);

  const goToDashboard = useCallback(() => {
    if (left.current) return;
    left.current = true;
    router.push("/dashboard");
  }, [router]);

  // Safety net so nobody is stuck on the welcome screen: videos are 5-10s, fallback is 6s.
  useEffect(() => {
    if (stage !== "video") return;
    router.prefetch("/dashboard");
    const t = window.setTimeout(goToDashboard, videoFailed ? 6000 : 20000);
    return () => window.clearTimeout(t);
  }, [stage, videoFailed, goToDashboard, router]);

  const q = questions[step];
  const selected = answers[q.id];
  const picked = Array.isArray(selected) ? selected : selected ? [selected] : [];
  const hasAnswer = picked.length > 0;
  const last = step === questions.length - 1;

  async function next() {
    if (!hasAnswer) return;
    if (!last) return setStep(step + 1);
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(answers),
      });
      // 503 = preview mode (sign-in not configured): do not trap the visitor here.
      if (!res.ok && res.status !== 503) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Could not save your answers. Please try again.");
      }
      setBusy(false);
      setStage("video");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save your answers. Please try again.");
      setBusy(false);
    }
  }

  return (
    <main className="ob-page">
      {stage === "video" && (
        <div className="ob-video" role="dialog" aria-label="Welcome to Eclipse">
          {videoFailed ? (
            <div className="ob-welcome">
              <LogoMark size={96} />
              <h2>Welcome to Eclipse</h2>
              <p>Setting up your studio…</p>
            </div>
          ) : (
            <video
              className="ob-video-el"
              src="/onboarding/welcome.mp4"
              autoPlay
              muted
              playsInline
              preload="auto"
              onEnded={goToDashboard}
              onError={() => setVideoFailed(true)}
            />
          )}
          <button type="button" className="ob-skip" onClick={goToDashboard}>Skip</button>
        </div>
      )}
      <div className={`ob-stage ${stage === "video" ? "is-leaving" : ""}`}>
      <div className="ob-brand"><LogoMark size={52} /></div>
      <section className="ob-card" aria-labelledby="ob-title">
        <p className="ob-step">Step {step + 1} of {questions.length}</p>
        <div className="ob-track" role="progressbar" aria-valuemin={1} aria-valuemax={questions.length} aria-valuenow={step + 1}>
          <div className="ob-fill" style={{ width: `${((step + 1) / questions.length) * 100}%` }} />
        </div>

        <fieldset className="ob-fieldset" key={q.id}>
          <legend id="ob-title" className="ob-title">{q.title}</legend>
          {q.multi && <p className="ob-hint">Select all that apply.</p>}
          <div className="ob-options">
            {q.options.map((opt) => (
              <label key={opt} className={`ob-option ${picked.includes(opt) ? "is-selected" : ""}`}>
                <input
                  type={q.multi ? "checkbox" : "radio"}
                  name={q.id}
                  value={opt}
                  checked={picked.includes(opt)}
                  onChange={() =>
                    setAnswers({
                      ...answers,
                      [q.id]: q.multi ? (picked.includes(opt) ? picked.filter((o) => o !== opt) : [...picked, opt]) : opt,
                    })
                  }
                />
                <span>{opt}</span>
                <i className={q.multi ? "ob-check" : "ob-radio"} aria-hidden="true" />
              </label>
            ))}
          </div>
        </fieldset>

        {error && <p className="ob-error" role="alert">{error}</p>}

        <div className="ob-actions">
          {step > 0 ? (
            <button type="button" className="ob-back" disabled={busy} onClick={() => setStep(step - 1)}>Back</button>
          ) : <span />}
          <button type="button" className="ob-next" disabled={!hasAnswer || busy} onClick={next}>
            {busy ? "Saving…" : last ? "Finish" : "Continue"}
          </button>
        </div>
      </section>
      </div>
    </main>
  );
}
