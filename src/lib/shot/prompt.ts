// The ShotMap prompt: fixed blocks, our own wording. The guide video is attached as video 1 (the order things are added in Video Studio names them).
import { PRESETS, colorName, type Setup } from "./setup";
import { POSES } from "./schema";

const poseText = (p: string) => (p === "driving" ? "at the wheel" : p.replace("-", " "));
const lensWords = (mm: number) => (mm <= 18 ? "ultra wide" : mm <= 30 ? "wide" : mm <= 50 ? "natural" : "telephoto");

export function shotPrompt(s: Setup, opts: { look?: string; sound?: string; exactSpeed?: boolean } = {}): string {
  const preset = PRESETS.find((p) => p.id === s.preset);
  const lines: string[] = [];
  lines.push("Use video 1 only as the guide for camera position, camera movement, timing and where each person and vehicle is. Match its framing and move closely.");
  lines.push("The coloured shapes in video 1 are stand-ins, not real objects. Never show capsules, spheres, flat colours, a grid or grey geometry. Replace them with real people, real vehicles and a real location.");
  lines.push(`Camera: ${s.lensMm} mm (${lensWords(s.lensMm)} lens), ${(preset?.label ?? "move").toLowerCase()}${s.shake > 0.05 ? ", gentle handheld shake" : ""}, ${s.durationS} seconds.`);
  const people = s.cast.filter((m) => m.kind === "person"), cars = s.cast.filter((m) => m.kind === "vehicle");
  for (const m of people) {
    const who = m.label.trim() || "a person";
    const acts = [m.pose !== "standing" ? poseText(m.pose) : "", m.pose2 ? `${poseText(m.pose2)} from ${m.pose2At} s` : "", m.moves && !m.rides ? "walks across the space" : ""].filter(Boolean).join(", ");
    lines.push(`The ${colorName(m.color)} figure is ${who}${acts ? `; ${acts}` : ""}.`);
  }
  for (const m of cars) lines.push(`The ${colorName(m.color)} vehicle is ${m.label.trim() || "a car"}${m.moves ? " and drives along the marked path" : ""}.`);
  if (opts.look?.trim()) lines.push(`Look: ${opts.look.trim()}`);
  lines.push(opts.exactSpeed ? "Follow the guide's speed exactly." : "Prefer natural motion and momentum over matching the guide's speed exactly.");
  lines.push("Keep each person and vehicle in the right place, keep identities and clothing unchanged, no extra people, no text or logos.");
  if (opts.sound?.trim()) lines.push(`Sound: ${opts.sound.trim()}`);
  return lines.join("\n");
}
export const KNOWN_POSES = POSES;
