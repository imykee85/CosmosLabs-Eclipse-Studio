"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { Eye, EyeOff, MailCheck, Send } from "lucide-react";
import { LogoMark } from "@/components/Logo";

export type Mode = "signin" | "signup";
export type Step = "credentials" | "verify" | "forgot" | "reset";

// Each handler resolves to an error message, a next step, or nothing (success / redirect).
export type Result = { error?: string; next?: Step; notice?: string } | void;
export type Handlers = {
  credentials: (email: string, password: string) => Promise<Result>;
  google: () => Promise<Result>;
  verify: (code: string) => Promise<Result>;
  resend: () => Promise<Result>;
  forgot: (email: string) => Promise<Result>;
  reset: (code: string, password: string) => Promise<Result>;
};

function GoogleG() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z" />
      <path fill="#FBBC05" d="M10.5 28.7c-.5-1.5-.8-3-.8-4.7s.3-3.2.8-4.7l-7.9-6.1C.9 16.4 0 20.1 0 24s.9 7.6 2.6 10.8l7.9-6.1z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.9 2.3-8.4 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
    </svg>
  );
}

const copy = {
  signin: { title: "sign in", intro: "Welcome back. Enter your credentials to continue.", submit: "Sign in" },
  signup: { title: "create account", intro: "Start creating with Eclipse. It only takes a minute.", submit: "Create account" },
};

export default function AuthView({ mode, handlers, demo }: { mode: Mode; handlers: Handlers; demo?: { email: string; password: string } }) {
  const [step, setStep] = useState<Step>("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function run(fn: () => Promise<Result>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const res = await fn();
      if (res?.error) setError(res.error);
      if (res?.notice) setNotice(res.notice);
      if (res?.next) {
        setStep(res.next);
        setCode("");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (step === "credentials") run(() => handlers.credentials(email, password));
    else if (step === "verify") run(() => handlers.verify(code));
    else if (step === "forgot") run(() => handlers.forgot(email));
    else run(() => handlers.reset(code, password));
  }

  const c = copy[mode];
  const title = step === "verify" ? (mode === "signup" ? "check your inbox" : "one more step") : step === "forgot" ? "reset password" : step === "reset" ? "new password" : c.title;
  const intro =
    step === "verify" ? (mode === "signup" ? `We sent a confirmation code to ${email}.` : "Enter the verification code to finish signing in.")
    : step === "forgot" ? "Enter your email and we will send you a code."
    : step === "reset" ? `Enter the code we sent to ${email} and choose a new password.`
    : c.intro;

  const passwordField = (label: string, autoComplete: string, withForgot: boolean) => (
    <>
      <div className="auth-label-row">
        <label htmlFor="auth-password">{label}</label>
        {withForgot && (
          <button type="button" className="auth-link" onClick={() => { setError(""); setStep("forgot"); }}>
            Forgot password?
          </button>
        )}
      </div>
      <div className="auth-input-wrap">
        <input
          id="auth-password"
          name="password"
          type={showPassword ? "text" : "password"}
          placeholder="••••••••"
          autoComplete={autoComplete}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={step === "credentials" && mode === "signin" ? undefined : 8}
        />
        <button
          type="button"
          className="auth-eye"
          aria-label={showPassword ? "Hide password" : "Show password"}
          onClick={() => setShowPassword(!showPassword)}
        >
          {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
    </>
  );

  return (
    <section className={`login-card auth-card ${step === "verify" && mode === "signup" ? "is-verify" : ""}`} aria-labelledby="auth-title">
      <Link href="/" className="auth-logo" aria-label="Eclipse home"><LogoMark size={56} /></Link>
      <h1 id="auth-title">{title}</h1>
      <p className="login-intro">{intro}</p>

      {demo && step === "credentials" && (
        <div className="auth-demo" role="note">
          <p>
            <strong>Demo mode.</strong>{" "}
            {mode === "signup"
              ? "Sign up with any email and a password of 8+ characters to try onboarding."
              : `Sign in with ${demo.email} / ${demo.password}.`}
          </p>
          <button type="button" onClick={() => { setEmail(demo.email); setPassword(demo.password); setError(""); }}>
            Fill demo login
          </button>
        </div>
      )}

      {step === "credentials" && (
        <>
          <button className="auth-google" type="button" disabled={busy} onClick={() => run(handlers.google)}>
            <GoogleG /> Continue with Google
          </button>
          <div className="auth-divider"><span>or continue with email</span></div>
        </>
      )}

      {step === "verify" && mode === "signup" && (
        <ol className="auth-steps">
          <li><span>1</span> Open the email from Eclipse.</li>
          <li><span>2</span> Copy your confirmation code.</li>
          <li><span>3</span> Enter it below and you land on your welcome steps.</li>
        </ol>
      )}

      <form onSubmit={onSubmit} className="auth-form" noValidate={false}>
        {(step === "credentials" || step === "forgot") && (
          <>
            <label htmlFor="auth-email">Email</label>
            <div className="auth-input-wrap">
              <input
                id="auth-email"
                name="email"
                type="email"
                placeholder="you@studio.com"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </>
        )}

        {(step === "verify" || step === "reset") && (
          <>
            <label htmlFor="auth-code">Verification code</label>
            <div className="auth-input-wrap">
              <input
                id="auth-code"
                name="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="123456"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
              />
            </div>
          </>
        )}

        {step === "credentials" && passwordField("Password", mode === "signin" ? "current-password" : "new-password", mode === "signin")}
        {step === "reset" && passwordField("New password", "new-password", false)}

        {mode === "signup" && step === "credentials" && <div id="clerk-captcha" />}

        {error && <p className="auth-error" role="alert">{error}</p>}

        {notice && <p className="auth-notice" role="status">{notice}</p>}
        {step === "verify" && mode === "signin" && (
          <button type="button" className="auth-link" disabled={busy} onClick={() => run(handlers.resend)}>Send the code again</button>
        )}

        <button className="auth-submit" type="submit" disabled={busy}>
          {busy ? "Please wait…" : step === "credentials" ? c.submit : step === "verify" ? (mode === "signup" ? "Verify email" : "Continue") : step === "forgot" ? "Send code" : "Reset password"}
        </button>
        {mode === "signup" && step === "credentials" && <p className="auth-terms">By creating an account you agree to the <a href="/terms" target="_blank" rel="noreferrer">Terms of Use</a> and <a href="/privacy" target="_blank" rel="noreferrer">Privacy Policy</a>.</p>}
      </form>

      {step === "verify" && mode === "signup" && (
        <div className="auth-sent">
          <span className="auth-sent-ico"><MailCheck size={18} /></span>
          <div>
            <b>Verify your email to start creating</b>
            <p>The code is on its way to {email}. It can take a minute.</p>
            <div className="auth-sent-row">
              <button type="button" className="auth-resend" disabled={busy} onClick={() => run(handlers.resend)}><Send size={14} /> Send the code again</button>
              <small>Check the spam folder too.</small>
            </div>
          </div>
        </div>
      )}

      {step === "credentials" ? (
        <p className="auth-switch">
          {mode === "signin" ? (
            <>Don&apos;t have an account? <Link href="/sign-up">Create one</Link></>
          ) : (
            <>Already have an account? <Link href="/sign-in">Sign in</Link></>
          )}
        </p>
      ) : (
        <p className="auth-switch">
          {step === "verify" && mode === "signup" ? (
            <>Wrong address? <button type="button" className="auth-link auth-link-strong" onClick={() => { setError(""); setNotice(""); setStep("credentials"); }}>Sign up again</button></>
          ) : (
            <button type="button" className="auth-link auth-link-strong" onClick={() => { setError(""); setStep("credentials"); }}>
              Back to {mode === "signin" ? "sign in" : "sign up"}
            </button>
          )}
        </p>
      )}
    </section>
  );
}
