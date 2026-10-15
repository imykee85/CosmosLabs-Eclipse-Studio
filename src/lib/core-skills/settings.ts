import { db } from "@/lib/db";

/** Built-in skills are on unless the person switched them off. */
export async function skillEnabled(userId: string, skillId: string): Promise<boolean> {
  const row = await db.skillSetting.findUnique({ where: { userId_skillId: { userId, skillId } } });
  return row ? row.enabled : true;
}
export async function setSkillEnabled(userId: string, skillId: string, enabled: boolean) {
  await db.skillSetting.upsert({ where: { userId_skillId: { userId, skillId } }, create: { userId, skillId, enabled }, update: { enabled } });
}
