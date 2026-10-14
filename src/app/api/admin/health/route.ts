import Anthropic from "@anthropic-ai/sdk";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { getAdmin } from "@/lib/admin";
import { connectModels } from "@/lib/connect-models";
import { db } from "@/lib/db";
import { safeText } from "@/lib/safe-text";

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
  { name: "ARK_API_KEY", kind: "Secret", needed: "Seedream models" },
  { name: "ELEVENLABS_API_KEY", kind: "Secret", needed: "Voice Studio: ElevenLabs voices" },
  { name: "FISH_API_KEY", kind: "Secret", needed: "Voice Studio: Fish Audio voices" },
  { name: "MINIMAX_API_KEY", kind: "Secret", needed: "Voice Studio: MiniMax voices" },
  { name: "DASHSCOPE_API_KEY", kind: "Secret", needed: "Voice Studio: Qwen voices (Singapore/international key)" },
  { name: "BYTEPLUS_VOICE_API_KEY", kind: "Secret", needed: "Voice Studio: Seed Audio (Seed Speech console key, not ARK_API_KEY)" },
  { name: "CRON_SECRET", kind: "Secret", needed: "daily finishing job" },
  { name: "ADMIN_EMAILS", kind: "Config", needed: "these owner pages" },
  { name: "CREDITS_ENABLED", kind: "Config", needed: "charging for renders" },
  { name: "NEXT_PUBLIC_CONTACT_EMAIL", kind: "Config", needed: "contact on legal pages" },
  { name: "NEXT_PUBLIC_SITE_URL", kind: "Config", needed: "links and sharing image" },
  { name: "WHOP_API_KEY", kind: "Secret", needed: "payments" },
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

  // Recent voices (Voice Studio)
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

  return NextResponse.json({ lines, at: new Date().toISOString() });
}
