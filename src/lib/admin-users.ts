import { clerkClient } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

// Owner only: what each account DOES in the app, as counts and times. Never prompts, pictures, project names, chats or any other content.
export type UserActivity = {
  id: string; label: string; joined: string | null; lastActive: Date | null;
  week: { images: number; videos: number; audio: number; models3d: number; motions: number; chats: number; creditsSpent: number };
  total: { images: number; videos: number; audio: number; models3d: number; motions: number; chats: number; creditsSpent: number };
};
const blank = () => ({ images: 0, videos: 0, audio: 0, models3d: 0, motions: 0, chats: 0, creditsSpent: 0 });
type Counts = ReturnType<typeof blank>;

export async function userActivity(limit = 100): Promise<{ rows: UserActivity[]; accounts: number; newToday: number; newWeek: number }> {
  const since = new Date(Date.now() - 7 * 86_400_000);
  const acc = new Map<string, { week: Counts; total: Counts; last: Date | null }>();
  const slot = (id: string) => { let s = acc.get(id); if (!s) { s = { week: blank(), total: blank(), last: null }; acc.set(id, s); } return s; };
  const add = (id: string, key: keyof Counts, n: number, last: Date | null, inWeek: boolean) => {
    const s = slot(id); if (inWeek) s.week[key] += n; else s.total[key] += n;
    if (last && (!s.last || last > s.last)) s.last = last;
  };
  const both = async <T extends { userId: string; _count?: { _all: number }; _max?: { createdAt: Date | null }; _sum?: { delta: number | null } }>(
    run: (where: { createdAt?: { gte: Date } }) => Promise<T[]>, key: (r: T) => keyof Counts | null, value: (r: T) => number,
  ) => {
    const [all, wk] = await Promise.all([run({}), run({ createdAt: { gte: since } })]);
    for (const r of all) { const k = key(r); if (k) add(r.userId, k, value(r), r._max?.createdAt ?? null, false); }
    for (const r of wk) { const k = key(r); if (k) add(r.userId, k, value(r), null, true); }
  };
  // Generation is split by kind (image or video), so group by both.
  const gen = (where: { createdAt?: { gte: Date } }) => db.generation.groupBy({ by: ["userId", "kind"], where: { ...where, status: "completed" }, _count: { _all: true }, _max: { createdAt: true } });
  const [gAll, gWk] = await Promise.all([gen({}), gen({ createdAt: { gte: since } })]);
  for (const r of gAll) add(r.userId, r.kind === "video" ? "videos" : "images", r._count._all, r._max.createdAt, false);
  for (const r of gWk) add(r.userId, r.kind === "video" ? "videos" : "images", r._count._all, null, true);
  await both((w) => db.audioJob.groupBy({ by: ["userId"], where: { ...w, status: "completed" }, _count: { _all: true }, _max: { createdAt: true } }), () => "audio", (r) => r._count?._all ?? 0);
  await both((w) => db.model3D.groupBy({ by: ["userId"], where: { ...w, status: "completed" }, _count: { _all: true }, _max: { createdAt: true } }), () => "models3d", (r) => r._count?._all ?? 0);
  await both((w) => db.motion.groupBy({ by: ["userId"], where: w, _count: { _all: true }, _max: { createdAt: true } }), () => "motions", (r) => r._count?._all ?? 0);
  await both((w) => db.chatSpend.groupBy({ by: ["userId"], where: w, _count: { _all: true }, _max: { createdAt: true } }), () => "chats", (r) => r._count?._all ?? 0);
  await both((w) => db.creditLedger.groupBy({ by: ["userId"], where: { ...w, reason: "CHARGE" }, _sum: { delta: true }, _max: { createdAt: true } }), () => "creditsSpent", (r) => Math.round(Math.abs(r._sum?.delta ?? 0)) / 10);

  const ids = [...acc.entries()].sort((a, b) => (b[1].last?.getTime() ?? 0) - (a[1].last?.getTime() ?? 0)).map(([id]) => id).slice(0, limit);
  const people = new Map<string, { label: string; joined: string | null }>();
  const personIds = ids.filter((i) => i.startsWith("user_"));
  try {
    const list = personIds.length ? await (await clerkClient()).users.getUserList({ userId: personIds, limit: 100 }) : { data: [] };
    for (const u of list.data) people.set(u.id, { label: u.primaryEmailAddress?.emailAddress ?? u.id.slice(-8), joined: new Date(u.createdAt).toISOString() });
  } catch { /* Clerk unreachable: show short ids */ }

  // Newest sign-ups, straight from Clerk.
  let newToday = 0, newWeek = 0, accounts = 0;
  try {
    const c = await clerkClient();
    accounts = await c.users.getCount();
    const recent = await c.users.getUserList({ orderBy: "-created_at", limit: 100 });
    for (const u of recent.data) { const t = Date.now() - u.createdAt; if (t < 86_400_000) newToday++; if (t < 7 * 86_400_000) newWeek++; }
  } catch { /* leave zeros */ }

  const rows = ids.map((id) => {
    const s = acc.get(id)!, p = people.get(id);
    return { id, label: p?.label ?? (id.startsWith("org_") ? `Team ${id.slice(-8)}` : id.slice(-8)), joined: p?.joined ?? null, lastActive: s.last, week: s.week, total: s.total };
  });
  return { rows, accounts, newToday, newWeek };
}
