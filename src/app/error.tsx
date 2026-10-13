"use client";

import { useEffect } from "react";
import ErrorScreen from "@/components/ErrorScreen";

// Any page that throws lands here instead of a blank screen. The error is logged (Vercel keeps the logs) with its digest, which matches the server-side entry.
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error("page error", { message: error.message, digest: error.digest }); }, [error]);
  return <ErrorScreen title="Something went wrong" text="That page hit a problem. Your work is saved. Try again, or go back to the dashboard." onRetry={reset} />;
}
