"use client";

import { useRouter } from "next/navigation";
import { useSignIn, useSignUp } from "@clerk/nextjs";
import AuthView, { type Handlers, type Mode } from "./AuthView";

const AFTER_AUTH = "/create";

function message(err: unknown) {
  const e = err as { errors?: { longMessage?: string; message?: string }[] };
  return e?.errors?.[0]?.longMessage ?? e?.errors?.[0]?.message ?? "Something went wrong. Please try again.";
}

export default function ClerkAuth({ mode }: { mode: Mode }) {
  const router = useRouter();
  const { isLoaded: inLoaded, signIn, setActive: setActiveIn } = useSignIn();
  const { isLoaded: upLoaded, signUp, setActive: setActiveUp } = useSignUp();
  const loading = { error: "Still loading. Please try again in a moment." };

  const handlers: Handlers = {
    async credentials(email, password) {
      try {
        if (mode === "signin") {
          if (!inLoaded) return loading;
          const res = await signIn.create({ identifier: email, password });
          if (res.status === "complete") {
            await setActiveIn({ session: res.createdSessionId });
            router.push(AFTER_AUTH);
            return;
          }
          return { error: "Extra verification is required for this account." };
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
        const opts = { strategy: "oauth_google", redirectUrl: "/sso-callback", redirectUrlComplete: AFTER_AUTH } as const;
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
        if (!upLoaded) return loading;
        const res = await signUp.attemptEmailAddressVerification({ code });
        if (res.status === "complete") {
          await setActiveUp({ session: res.createdSessionId });
          router.push(AFTER_AUTH);
          return;
        }
        return { error: "That code didn't work. Check it and try again." };
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
          router.push(AFTER_AUTH);
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
