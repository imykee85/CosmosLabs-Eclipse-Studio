// The server-side secret that signs links and tokens. Taken from the configured keys; the fixed development value exists ONLY outside production,
// so a missing key on the live site stops the feature instead of silently signing with a value anyone can read in the source.
export function serverSecret(...preferred: (string | undefined)[]): string {
  const key = preferred.find((k) => k && k.length > 0);
  if (key) return key;
  if (process.env.NODE_ENV === "production") throw new Error("No secret key is set (CONNECT_SECRET_KEY or CLERK_SECRET_KEY).");
  return "dev-only-not-secret";
}
