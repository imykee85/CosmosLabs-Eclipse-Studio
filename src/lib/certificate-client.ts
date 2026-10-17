// Asks the server to issue (or return) the certificate of one finished creation. Returns its public code.
export async function getCertificate(source: "render" | "audio", id: string): Promise<string> {
  const res = await fetch("/api/certificates", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ source, id }) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.certificate?.code) throw new Error(data.error ?? "Could not issue the certificate.");
  return data.certificate.code as string;
}
