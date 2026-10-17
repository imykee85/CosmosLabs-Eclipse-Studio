"use client";

// The browser side of /api/sandbox/jobs: start a job, follow it until it ends (asking every 2 seconds is also what moves it forward), cancel it.
export type SandboxJobView = {
  id: string; kind: string; status: "queued" | "creating" | "running" | "collecting" | "succeeded" | "failed" | "canceled" | "expired"; message: string | null;
  output: Record<string, unknown> | null; error: { code: string; message: string } | null; creditsCharged: number;
};
const FINAL = ["succeeded", "failed", "canceled", "expired"];
export const isFinal = (j: SandboxJobView) => FINAL.includes(j.status);

export async function startSandboxJob(kind: string, input: unknown): Promise<{ ok: true; job: SandboxJobView } | { ok: false; error: string }> {
  try {
    const r = await fetch("/api/sandbox/jobs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, input }) });
    const d = await r.json().catch(() => null);
    if (!r.ok || !d?.job) return { ok: false, error: typeof d?.error === "string" ? d.error : "It could not be started. Please try again." };
    return { ok: true, job: d.job as SandboxJobView };
  } catch { return { ok: false, error: "Check your connection and try again." }; }
}

/** Follows a job until it ends; `onUpdate` sees every state. Stop following by aborting the signal. */
export async function followSandboxJob(id: string, onUpdate: (j: SandboxJobView) => void, signal?: AbortSignal): Promise<SandboxJobView | null> {
  let misses = 0;
  while (!signal?.aborted) {
    await new Promise((r) => setTimeout(r, 2000));
    try {
      const r = await fetch(`/api/sandbox/jobs/${id}`, { cache: "no-store", signal });
      const d = await r.json().catch(() => null);
      if (r.ok && d?.job) { misses = 0; onUpdate(d.job); if (isFinal(d.job)) return d.job; }
      else if (r.status === 404) return null;
      else if (++misses > 10) return null;
    } catch { if (signal?.aborted || ++misses > 10) return null; }
  }
  return null;
}

export async function cancelSandboxJob(id: string): Promise<SandboxJobView | null> {
  try { const r = await fetch(`/api/sandbox/jobs/${id}/cancel`, { method: "POST" }); const d = await r.json().catch(() => null); return r.ok ? (d?.job ?? null) : null; } catch { return null; }
}

/** Starts the browser's download of a link (a signed storage link that sends the file as an attachment). */
export function downloadLink(url: string) {
  const a = document.createElement("a");
  a.href = url; a.rel = "noopener"; a.download = "";
  document.body.appendChild(a); a.click(); a.remove();
}
