"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LogoMark } from "@/components/Logo";
import { questions, type Answers } from "@/lib/onboarding";
import "./onboarding.css";

export default function OnboardingFlow() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Partial<Answers>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const q = questions[step];
  const selected = answers[q.id];
  const last = step === questions.length - 1;

  async function next() {
    if (!selected) return;
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
      router.push("/create");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save your answers. Please try again.");
      setBusy(false);
    }
  }

  return (
    <main className="ob-page">
      <div className="ob-brand"><LogoMark size={52} /></div>
      <section className="ob-card" aria-labelledby="ob-title">
        <p className="ob-step">Step {step + 1} of {questions.length}</p>
        <div className="ob-track" role="progressbar" aria-valuemin={1} aria-valuemax={questions.length} aria-valuenow={step + 1}>
          <div className="ob-fill" style={{ width: `${((step + 1) / questions.length) * 100}%` }} />
        </div>

        <fieldset className="ob-fieldset" key={q.id}>
          <legend id="ob-title" className="ob-title">{q.title}</legend>
          <div className="ob-options">
            {q.options.map((opt) => (
              <label key={opt} className={`ob-option ${selected === opt ? "is-selected" : ""}`}>
                <input
                  type="radio"
                  name={q.id}
                  value={opt}
                  checked={selected === opt}
                  onChange={() => setAnswers({ ...answers, [q.id]: opt })}
                />
                <span>{opt}</span>
                <i className="ob-radio" aria-hidden="true" />
              </label>
            ))}
          </div>
        </fieldset>

        {error && <p className="ob-error" role="alert">{error}</p>}

        <div className="ob-actions">
          {step > 0 ? (
            <button type="button" className="ob-back" disabled={busy} onClick={() => setStep(step - 1)}>Back</button>
          ) : <span />}
          <button type="button" className="ob-next" disabled={!selected || busy} onClick={next}>
            {busy ? "Saving…" : last ? "Finish" : "Continue"}
          </button>
        </div>
      </section>
    </main>
  );
}
