import { expiryRules } from "@/lib/expiry";
import Anthropic from "@anthropic-ai/sdk";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { getAdmin } from "@/lib/admin";
import { connectModels } from "@/lib/connect-models";
import { db } from "@/lib/db";
import { safeText } from "@/lib/safe-text";
import { baseSnapshotId, getSetting, SETTING } from "@/lib/sandbox";
import { usageNow } from "@/lib/sandbox/usage";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Owner only: one report of how this deployment is set up, so nobody has to dig through Vercel logs. It never contains a key or a secret:
// settings are only reported as "set" or "missing". The Anthropic check makes one tiny real request (a few tokens).
const SETTINGS: { name: string; kind: "Secret" | "Config"; needed: string }[] = [
  { name: "DATABASE_URL", kind: "Secret", needed: "everything stored" },
  { name: "DIRECT_URL", kind: "Secret", needed: "creating new tables on deploy" },
  { name: "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", kind: "Config", needed: "sign-in" },
  { name: "CLERK_SECRET_KEY", kind: "Secret", needed: "sign-in" },
  { name: "HIGGSFIELD_API_KEY", kind: "Secret", needed: "image and video" },
  { name: "R2_ACCOUNT_ID", kind: "Secret", needed: "file storage" },
  { name: "R2_ACCESS_KEY_ID", kind: "Secret", needed: "file storage" },
  { name: "R2_SECRET_ACCESS_KEY", kind: "Secret", needed: "file storage" },
  { name: "R2_BUCKET", kind: "Secret", needed: "file storage" },
  { name: "ANTHROPIC_API_KEY", kind: "Secret", needed: "Core, Atlas, Prompts, upload scan" },
  { name: "GEMINI_API_KEY", kind: "Secret", needed: "Google models" },
  { name: "OPENAI_API_KEY", kind: "Secret", needed: "GPT models" },
  { name: "ARK_API_KEY", kind: "Secret", needed: "Seedream models and the direct Seedance video route (ROUTE_SEEDANCE_2_5=direct)" },
  { name: "ELEVENLABS_API_KEY", kind: "Secret", needed: "Audio Studio: ElevenLabs voices" },
  { name: "FISH_API_KEY", kind: "Secret", needed: "Audio Studio: Fish Audio voices" },
  { name: "MINIMAX_API_KEY", kind: "Secret", needed: "Audio Studio: MiniMax voices" },
  { name: "DASHSCOPE_API_KEY", kind: "Secret", needed: "Audio Studio: Qwen voices (Singapore/international key)" },
  { name: "BYTEPLUS_VOICE_API_KEY", kind: "Secret", needed: "Audio Studio: Seed Audio (Seed Speech console key, not ARK_API_KEY)" },
  { name: "MIRELO_API_KEY", kind: "Secret", needed: "Audio Studio: Mirelo sound effects and Add sound to video" },
  { name: "CRON_SECRET", kind: "Secret", needed: "daily finishing job" },
  { name: "ADMIN_EMAILS", kind: "Config", needed: "these owner pages" },
  { name: "CREDITS_ENABLED", kind: "Config", needed: "charging for renders" },
  { name: "NEXT_PUBLIC_CONTACT_EMAIL", kind: "Config", needed: "contact on legal pages" },
  { name: "NEXT_PUBLIC_SITE_URL", kind: "Config", needed: "links and sharing image" },
  { name: "WHOP_API_KEY", kind: "Secret", needed: "payments" },
  { name: "WHOP_WEBHOOK_SECRET", kind: "Secret", needed: "payments: checking Whop's webhook deliveries" },
  { name: "WHOP_COMPANY_ID", kind: "Config", needed: "payments: checkout (biz_...)" },
  { name: "WHOP_PRODUCT_ID", kind: "Config", needed: "payments: custom and automatic top-ups (prod_...)" },
  { name: "WHOP_PLAN_STARTER", kind: "Config", needed: "payments: Starter plan" },
  { name: "WHOP_PLAN_GROWTH", kind: "Config", needed: "payments: Growth plan" },
  { name: "WHOP_PLAN_SCALE", kind: "Config", needed: "payments: Scale plan" },
  { name: "WHOP_PLAN_TOPUP_500", kind: "Config", needed: "payments: 500-credit top-up" },
  { name: "WHOP_PLAN_TOPUP_2000", kind: "Config", needed: "payments: 2,000-credit top-up" },
  { name: "WHOP_PLAN_TOPUP_6000", kind: "Config", needed: "payments: 6,000-credit top-up" },
  { name: "WHOP_PLAN_TOPUP_10000", kind: "Config", needed: "payments: 10,000-credit top-up (1,000 credits)" },
  { name: "SANDBOX_PROVIDER", kind: "Config", needed: "the sandbox platform (set to vercel)" },
];

export async function POST() {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "Not allowed" }, { status: 403 });

  const lines: string[] = [];
  const add = (ok: boolean | null, text: string) => lines.push(`${ok === null ? "-" : ok ? "OK" : "PROBLEM"}  ${text}`);

  add(null, `Deployment: ${process.env.VERCEL_ENV ?? "local"}, commit ${(process.env.VERCEL_GIT_COMMIT_SHA ?? "unknown").slice(0, 7)}`);

  // Database and tables
  try {
    await db.$queryRaw`SELECT 1`;
    const rows = await db.$queryRaw<{ table_name: string }[]>`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`;
    const have = new Set(rows.map((r) => r.table_name));
    const missing = Prisma.dmmf.datamodel.models.map((m) => m.dbName ?? m.name).filter((t) => !have.has(t));
    add(true, "Database reachable");
    add(missing.length === 0, missing.length ? `Tables missing: ${missing.join(", ")} (the schema step did not run: DIRECT_URL missing or the build skipped it)` : `All ${Prisma.dmmf.datamodel.models.length} tables exist (the schema step worked)`);
  } catch (err) {
    add(false, `Database: ${safeText(err instanceof Error ? err.message : String(err))}`);
  }

  // Settings: only set or missing
  const missing = SETTINGS.filter((s) => !process.env[s.name]);
  add(null, `Settings set: ${SETTINGS.length - missing.length} of ${SETTINGS.length}`);
  for (const s of missing) lines.push(`MISSING  ${s.name} (${s.kind}) for ${s.needed}`);

  // Anthropic: one tiny real request
  if (!process.env.ANTHROPIC_API_KEY) add(false, "Anthropic: no key set on this deployment");
  else {
    try {
      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 0, timeout: 15_000 });
      await client.messages.create({ model: connectModels.find((m) => m.id === "claude-haiku-5-5")!.api, max_tokens: 5, messages: [{ role: "user", content: "Hi" }] });
      add(true, "Anthropic key works and the account has credit");
    } catch (err) {
      add(false, `Anthropic: ${safeText(err instanceof Error ? err.message : String(err))}`);
    }
  }

  // Recent renders
  try {
    const since = new Date(Date.now() - 24 * 3600_000);
    const [total, failed, last] = await Promise.all([
      db.generation.count({ where: { createdAt: { gte: since } } }),
      db.generation.count({ where: { createdAt: { gte: since }, status: "failed" } }),
      db.generation.findFirst({ where: { status: "failed" }, orderBy: { updatedAt: "desc" }, select: { model: true, kind: true, error: true } }),
    ]);
    add(null, `Renders in the last 24 hours: ${total}, failed: ${failed}`);
    if (last) add(null, `Latest failure (${last.kind}, ${last.model ?? "unknown model"}): ${safeText(last.error ?? "no text")}`);
  } catch {
    add(null, "Renders: could not be counted");
  }

  // Recent voices (Audio Studio)
  try {
    const since = new Date(Date.now() - 24 * 3600_000);
    const [total, failed, last] = await Promise.all([
      db.audioJob.count({ where: { createdAt: { gte: since } } }),
      db.audioJob.count({ where: { createdAt: { gte: since }, status: "failed" } }),
      db.audioJob.findFirst({ where: { status: "failed" }, orderBy: { updatedAt: "desc" }, select: { model: true, error: true, params: true } }),
    ]);
    add(null, `Voices in the last 24 hours: ${total}, failed: ${failed}`);
    if (last) add(null, `Latest voice failure (${last.model}, code ${(last.params as { failCode?: string } | null)?.failCode ?? "none"}): ${safeText(last.error ?? "no text")}`);
  } catch {
    add(null, "Voices: could not be counted");
  }

  // Sandbox platform (Vercel Sandbox): set-up and this month's use of the free allowance
  try {
    if (!process.env.SANDBOX_PROVIDER) add(null, "Sandbox: switched off (SANDBOX_PROVIDER is not set)");
    else {
      const [snap, smoke, u, failed] = await Promise.all([baseSnapshotId(), getSetting(SETTING.smokePassed), usageNow(), db.sandboxJob.findFirst({ where: { status: { in: ["failed", "expired"] } }, orderBy: { updatedAt: "desc" }, select: { kind: true, error: true, updatedAt: true } })]);
      add(Boolean(snap), snap ? `Sandbox base snapshot: ${snap}${smoke === snap ? " (smoke test passed)" : " (smoke test NOT passed yet: run it from /admin/sandbox)"}` : "Sandbox: no base snapshot yet (Build the base on /admin/sandbox)");
      add(u.share < 0.8, `Sandbox use this month: ${Math.round(u.share * 100)}% of the free allowance (${u.used.creations} sandboxes, ${(u.used.activeCpuMs / 3_600_000).toFixed(2)} CPU hours)`);
      if (failed) add(null, `Latest sandbox failure (${failed.kind}, ${failed.updatedAt.toISOString().slice(0, 16).replace("T", " ")} UTC${failed.kind === "build.base" && snap && smoke === snap ? ", the base built and passed its smoke test since: nothing to do" : ""}): ${safeText((failed.error as { message?: string; detail?: string } | null)?.detail ?? (failed.error as { message?: string } | null)?.message ?? "no text")}`);
    }
  } catch {
    add(null, "Sandbox: could not be checked");
  }

  // Payment provider deliveries: what arrived and what we did with it. The field list is the SHAPE only (names and types, never values),
  // to compare with what the code expects and to send to the provider's support when something does not match.
  try {
    const since = new Date(Date.now() - 7 * 24 * 3600 * 1000);
    const [unmatched, recent] = await Promise.all([
      db.paymentEventLog.count({ where: { createdAt: { gte: since }, outcome: { in: ["unmatched", "error"] } } }),
      db.paymentEventLog.findMany({ orderBy: { createdAt: "desc" }, take: 8 }),
    ]);
    if (!recent.length) add(null, "Payment events: none received yet");
    else {
      add(unmatched === 0, `Payment events needing attention in the last 7 days: ${unmatched}`);
      for (const e of recent) {
        add(e.outcome === "unmatched" || e.outcome === "error" ? false : null, `Payment event ${e.createdAt.toISOString()} ${e.type}: ${e.outcome}${e.detail ? ` (${safeText(e.detail)})` : ""}`);
        lines.push(`      fields: ${Object.entries((e.shape ?? {}) as Record<string, string>).map(([k, v]) => `${k}:${v}`).join(", ").slice(0, 1500)}`);
      }
    }
  } catch {
    add(null, "Payment events: could not be read");
  }

  // Page security policy (Content Security Policy): what browsers reported in the last 7 days. In report mode nothing is blocked; the rule is
  // ready to enforce (CSP_MODE=enforce) when this shows no real violations after the owner has used sign-in, Image Studio, Settings and checkout.
  try {
    const since = new Date(Date.now() - 7 * 24 * 3600 * 1000);
    const groups = await db.cspReport.groupBy({ by: ["directive", "blocked"], where: { createdAt: { gte: since } }, _count: { _all: true }, orderBy: { _count: { directive: "desc" } }, take: 8 });
    const mode = process.env.CSP_MODE === "enforce" ? "ENFORCING" : "report only (nothing is blocked)";
    if (!groups.length) add(true, `Page security policy: ${mode}; no violations reported in the last 7 days`);
    else {
      add(false, `Page security policy: ${mode}; ${groups.reduce((n, g) => n + g._count._all, 0)} violation reports in the last 7 days`);
      for (const g of groups) add(null, `Policy violation x${g._count._all}: ${safeText(g.directive)} blocked ${safeText(g.blocked) || "(inline)"}`);
    }
  } catch {
    add(null, "Page security policy: could not be read");
  }

  // Free trial farm check (master brief section 13, batch 8): how many accounts took the 2 free images in the last 7 days against how many paid, and what that
  // costs at the dearest default-resolution image price. A high ratio of free-only accounts is the sign of one person making many accounts.
  try {
    const since = new Date(Date.now() - 7 * 24 * 3600 * 1000);
    const [claimed, usedAny, paying] = await Promise.all([
      db.freeRender.count({ where: { createdAt: { gte: since } } }),
      db.freeRender.count({ where: { createdAt: { gte: since }, remaining: { lt: 2 } } }),
      db.creditLedger.findMany({ where: { reason: "PURCHASE", createdAt: { gte: since } }, distinct: ["userId"], select: { userId: true } }),
    ]);
    add(claimed < 200 || paying.length * 10 >= claimed, `Free trial, last 7 days: ${claimed} accounts got it, ${usedAny} used at least one render, ${paying.length} accounts paid. Worst case about $${(usedAny * 2 * 0.24).toFixed(2)} of provider cost (two dearest renders each).`);
  } catch {
    add(null, "Free trial check: could not be read");
  }

  // Credit expiry and chat cost this month.
  try {
    const rules = expiryRules();
    add(null, rules.start == null ? "Credit expiry: OFF (CREDIT_EXPIRY_START is not set). See /admin/expiry for the dry run." : `Credit expiry: ON from ${new Date(rules.start).toISOString().slice(0, 10)} (plan ${rules.planDays} days, top-ups ${rules.topupDays} days, grace ${rules.graceDays} days)`);
    const expired = await db.creditLedger.aggregate({ where: { reason: "EXPIRE", createdAt: { gte: new Date(Date.now() - 30 * 24 * 3600 * 1000) } }, _sum: { delta: true }, _count: { _all: true } });
    if (expired._count._all) add(null, `Credits expired in the last 30 days: ${-(expired._sum.delta ?? 0) / 10} credits in ${expired._count._all} grants`);
    const first = new Date(); first.setUTCDate(1); first.setUTCHours(0, 0, 0, 0);
    const spend = await db.chatSpend.aggregate({ where: { createdAt: { gte: first } }, _sum: { usd: true, charged: true }, _count: { _all: true } });
    add(null, `Chat this month: ${spend._count._all} replies, real cost $${(spend._sum.usd ?? 0).toFixed(2)}, charged ${(spend._sum.charged ?? 0) / 10} credits ($${((spend._sum.charged ?? 0) / 100).toFixed(2)})`);
  } catch {
    add(null, "Expiry and chat cost: could not be read");
  }

  return NextResponse.json({ lines, at: new Date().toISOString() });
}
