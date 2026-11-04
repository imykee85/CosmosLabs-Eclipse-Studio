import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

// A "kit" is a vendored folder of programs (core/skills/builtin/<name>) that a sandbox job copies into the sandbox before it runs them. Read from disk
// once per server instance. The folders ship with the routes that start these jobs (outputFileTracingIncludes in next.config.mjs).
export type KitFile = { path: string; content: Buffer; mode?: number };
const cache = new Map<string, KitFile[]>();

export function kitFiles(name: "ffmpeg-skill" | "scenario-kinetic-film", prefix: string, only: (rel: string) => boolean = () => true): KitFile[] {
  const key = `${name}:${prefix}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const root = path.join(/*turbopackIgnore: true*/ process.cwd(), "core", "skills", "builtin", name);
  const out: KitFile[] = [];
  const walk = (dir: string, rel: string) => {
    for (const entry of readdirSync(dir)) {
      if (entry === "__pycache__" || entry.startsWith(".")) continue;
      const full = path.join(dir, entry), r = rel ? `${rel}/${entry}` : entry;
      if (statSync(full).isDirectory()) walk(full, r);
      else if (only(r)) out.push({ path: `${prefix}/${r}`, content: readFileSync(full) });
    }
  };
  walk(root, "");
  cache.set(key, out);
  return out;
}
