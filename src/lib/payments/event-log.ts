import { db } from "@/lib/db";

// A record of the payment-provider deliveries we received, kept so the first real events can be compared with what the code expects.
// Only the SHAPE is stored (field paths and value types), never values: no names, emails, amounts or ids beyond our own external id.

const KEEP = 300;

/** Field paths and value types of a JSON value, e.g. { "data.plan.id": "string", "data.metadata.userId": "string" }. */
export function shapeOf(value: unknown, prefix = "", out: Record<string, string> = {}, depth = 0): Record<string, string> {
  if (Object.keys(out).length >= 200) return out;
  if (value === null) out[prefix || "(root)"] = "null";
  else if (Array.isArray(value)) {
    out[prefix || "(root)"] = `array(${value.length})`;
    if (value.length && depth < 5) shapeOf(value[0], `${prefix}[0]`, out, depth + 1);
  } else if (typeof value === "object") {
    if (depth >= 5) out[prefix] = "object";
    else for (const [k, v] of Object.entries(value as Record<string, unknown>)) shapeOf(v, prefix ? `${prefix}.${k}` : k, out, depth + 1);
  } else out[prefix || "(root)"] = typeof value;
  return out;
}

export type EventOutcome = "applied" | "duplicate" | "ignored" | "unmatched" | "error";

/** Never throws: logging must not change how a delivery is answered. */
export async function logPaymentEvent(provider: string, rawBody: string, outcome: EventOutcome, externalId?: string | null, detail?: string): Promise<void> {
  try {
    let parsed: unknown = null;
    try { parsed = JSON.parse(rawBody); } catch { /* left as null */ }
    const type = parsed && typeof parsed === "object" && typeof (parsed as { type?: unknown }).type === "string" ? (parsed as { type: string }).type : "unknown";
    await db.paymentEventLog.create({ data: { provider, type, externalId: externalId ?? null, outcome, detail: detail?.slice(0, 300) ?? null, shape: shapeOf(parsed) } });
    if (outcome === "unmatched" || outcome === "error") console.error(`PAYMENT ALERT: ${provider} ${type} ${externalId ?? ""} ${outcome}: ${detail ?? ""}`);
    if (Math.random() < 0.05) {
      const old = await db.paymentEventLog.findMany({ orderBy: { createdAt: "desc" }, skip: KEEP, select: { id: true } });
      if (old.length) await db.paymentEventLog.deleteMany({ where: { id: { in: old.map((r) => r.id) } } });
    }
  } catch (err) {
    console.error("could not log a payment event", err);
  }
}
