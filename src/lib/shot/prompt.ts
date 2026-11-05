// The ShotMap prompt: fixed blocks, our own wording. The guide video is attached as video 1 (the order things are added in Video Studio names them).
import { camCount, camOf, colorName, moveLabel, totalS, type Setup } from "./setup";
import { POSES } from "./schema";

const poseText = (p: string) => (p === "driving" ? "at the wheel" : p.replace("-", " "));
const lensWords = (mm: number) => (mm <= 18 ? "ultra wide" : mm <= 30 ? "wide" : mm <= 50 ? "natural" : "telephoto");

export function shotPrompt(s: Setup, opts: { look?: string; sound?: string; exactSpeed?: boolean } = {}): string {
  const lines: string[] = [];
  lines.push("Use video 1 only as the guide for camera position, camera movement, timing and where each person and vehicle is. Match its camera move closely, but take only the movement and the positions from it: ignore the shape of its frame and use the aspect ratio of the video you are making.");
  lines.push("The coloured shapes in video 1 are stand-ins, not real objects. Never show capsules, spheres, flat colours, a grid or grey geometry. Replace them with real people, real vehicles and a real location.");
  const nCams = camCount(s);
  if (nCams === 1) {
    lines.push(`Camera: ${s.lensMm} mm (${lensWords(s.lensMm)} lens), ${moveLabel(s).toLowerCase()}${(s.speed ?? 1) >= 1.4 ? ", fast" : (s.speed ?? 1) <= 0.7 ? ", slow" : ""}${s.shake > 0.05 ? ", gentle handheld shake" : ""}, ${s.durationS} seconds.`);
  } else {
    let t0 = 0;
    for (let i = 0; i < nCams; i++) {
      const c = camOf(s, i), v = { ...s, ...c }, end = Math.round((t0 + c.durationS) * 10) / 10;
      lines.push(`${i === 0 ? "Camera 1" : `Then a hard cut to camera ${i + 1}`} (${Math.round(t0 * 10) / 10} to ${end} s): ${c.lensMm} mm (${lensWords(c.lensMm)} lens), ${moveLabel(v).toLowerCase()}${(c.speed ?? 1) >= 1.4 ? ", fast" : (c.speed ?? 1) <= 0.7 ? ", slow" : ""}${c.shake > 0.05 ? ", gentle handheld shake" : ""}.`);
      t0 = end;
    }
    lines.push(`It is one continuous scene shown from ${nCams} angles: the people and vehicles keep moving through the cuts, ${totalS(s)} seconds in all.`);
  }
  const people = s.cast.filter((m) => m.kind === "person"), cars = s.cast.filter((m) => m.kind === "vehicle");
  for (const m of people) {
    const who = m.label.trim() || (m.build === "woman" ? "a woman" : "a man");
    const acts = [m.pose !== "standing" ? poseText(m.pose) : "", m.pose2 ? `${poseText(m.pose2)} from ${m.pose2At} s` : "", m.moves && !m.rides ? "walks across the space" : ""].filter(Boolean).join(", ");
    lines.push(`The ${colorName(m.color)} figure is ${who}${acts ? `; ${acts}` : ""}.`);
  }
  const things = (s.objects ?? []).map((o) => o.type === "lamppost" ? "lamp post" : o.type); if (things.length) lines.push(`Set pieces in the scene (grey blocks in video 1, make them real and in the same places): ${Array.from(new Set(things)).join(", ")}.`);
  for (const m of cars) lines.push(`The ${colorName(m.color)} vehicle is ${m.label.trim() || "a car"}${m.moves ? " and drives along the marked path" : ""}.`);
  if (opts.look?.trim()) lines.push(`Look: ${opts.look.trim()}`);
  lines.push(opts.exactSpeed ? "Follow the guide's speed exactly." : "Prefer natural motion and momentum over matching the guide's speed exactly.");
  lines.push("Keep each person and vehicle in the right place, keep identities and clothing unchanged, no extra people, no text or logos.");
  if (opts.sound?.trim()) lines.push(`Sound: ${opts.sound.trim()}`);
  return lines.join("\n");
}
export const KNOWN_POSES = POSES;
