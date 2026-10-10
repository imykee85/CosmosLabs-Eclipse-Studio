"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import { useSignIn, useSignUp } from "@clerk/nextjs";
import AuthView, { type Handlers, type Mode, type Result } from "./AuthView";

const AFTER_SIGN_IN = "/dashboard";
const AFTER_SIGN_UP = "/onboarding"; // new accounts answer a few questions first

// Signing in can need one more code: a second factor, or Clerk's "new device" check, which sends an email code. The installed Clerk typings
// predate the email-code kind, so the sign-in object is read through this narrow shape instead of casting every call.
type Factor = { strategy: string; emailAddressId?: string; phoneNumberId?: string };
type Resource = { status: string | null; createdSessionId: string | null };
type SecondFactorSignIn = Resource & {
  supportedSecondFactors?: Factor[] | null;
  prepareSecondFactor: (params: Record<string, unknown>) => Promise<unknown>;
  attemptSecondFactor: (params: Record<string, unknown>) => Promise<Resource>;
};
const NEEDS_CODE = ["needs_second_factor", "needs_client_trust"];
const FACTOR_ORDER = ["email_code", "phone_code", "totp"];

function message(err: unknown) {
  const e = err as { errors?: { longMessage?: string; message?: string }[] };
  return e?.errors?.[0]?.longMessage ?? e?.errors?.[0]?.message ?? "Something went wrong. Please try again.";
}

export default function ClerkAuth({ mode }: { mode: Mode }) {
  const router = useRouter();
  const { isLoaded: inLoaded, signIn, setActive: setActiveIn } = useSignIn();
  const { isLoaded: upLoaded, signUp, setActive: setActiveUp } = useSignUp();
  const loading = { error: "Still loading. Please try again in a moment." };
  const factor = useRef<string>("");

  // Pick the first code method the account offers, send the code (an authenticator app needs no sending) and remember which one it was.
  async function requestCode(res: SecondFactorSignIn): Promise<Result> {
    const options = res.supportedSecondFactors ?? [];
    const chosen = FACTOR_ORDER.map((s) => options.find((f) => f.strategy === s)).find(Boolean);
    if (!chosen) return { error: "This account needs a verification method that this screen does not support yet." };
    factor.current = chosen.strategy;
    if (chosen.strategy === "totp") return { next: "verify", notice: "Open your authenticator app and enter the current code." };
    const target = chosen.strategy === "email_code" ? { emailAddressId: chosen.emailAddressId } : { phoneNumberId: chosen.phoneNumberId };
    await res.prepareSecondFactor({ strategy: chosen.strategy, ...target });
    return { next: "verify" };
  }

  const handlers: Handlers = {
    async credentials(email, password) {
      try {
        if (mode === "signin") {
          if (!inLoaded) return loading;
          const res = await signIn.create({ identifier: email, password });
          if (res.status === "complete") {
            await setActiveIn({ session: res.createdSessionId });
            router.push(AFTER_SIGN_IN);
            return;
          }
          if (NEEDS_CODE.includes(res.status ?? "")) return await requestCode(res as unknown as SecondFactorSignIn);
          return { error: "Sign-in could not be completed. Please try again." };
        }
        if (!upLoaded) return loading;
        await signUp.create({ emailAddress: email, password });
        await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
        return { next: "verify" };
      } catch (err) {
        return { error: message(err) };
      }
    },

    async google() {
      try {
        const opts = { strategy: "oauth_google", redirectUrl: "/sso-callback", redirectUrlComplete: mode === "signup" ? AFTER_SIGN_UP : AFTER_SIGN_IN } as const;
        if (mode === "signin") {
          if (!inLoaded) return loading;
          await signIn.authenticateWithRedirect(opts);
        } else {
          if (!upLoaded) return loading;
          await signUp.authenticateWithRedirect(opts);
        }
      } catch (err) {
        return { error: message(err) };
      }
    },

    async verify(code) {
      try {
        if (mode === "signin") {
          if (!inLoaded) return loading;
          const res = await (signIn as unknown as SecondFactorSignIn).attemptSecondFactor({ strategy: factor.current, code: code.trim() });
          if (res.status === "complete") {
            await setActiveIn({ session: res.createdSessionId });
            router.push(AFTER_SIGN_IN);
            return;
          }
          return { error: "That code didn't work. Check it and try again." };
        }
        if (!upLoaded) return loading;
        const res = await signUp.attemptEmailAddressVerification({ code });
        if (res.status === "complete") {
          await setActiveUp({ session: res.createdSessionId });
          router.push(AFTER_SIGN_UP);
          return;
        }
        return { error: "That code didn't work. Check it and try again." };
      } catch (err) {
        return { error: message(err) };
      }
    },

    async resend() {
      try {
        if (mode === "signin") {
          if (!inLoaded) return loading;
          const res = await requestCode(signIn as unknown as SecondFactorSignIn);
          return res && res.error ? res : { notice: factor.current === "totp" ? "Open your authenticator app for the current code." : "We sent you a new code." };
        }
        if (!upLoaded) return loading;
        await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
        return { notice: "We sent you a new code." };
      } catch (err) {
        return { error: message(err) };
      }
    },

    async forgot(email) {
      try {
        if (!inLoaded) return loading;
        await signIn.create({ strategy: "reset_password_email_code", identifier: email });
        return { next: "reset" };
      } catch (err) {
        return { error: message(err) };
      }
    },

    async reset(code, password) {
      try {
        if (!inLoaded) return loading;
        const res = await signIn.attemptFirstFactor({ strategy: "reset_password_email_code", code, password });
        if (res.status === "complete") {
          await setActiveIn({ session: res.createdSessionId });
          router.push(AFTER_SIGN_IN);
          return;
        }
        return { error: "Could not reset the password. Please try again." };
      } catch (err) {
        return { error: message(err) };
      }
    },
  };

  return <AuthView mode={mode} handlers={handlers} />;
}
