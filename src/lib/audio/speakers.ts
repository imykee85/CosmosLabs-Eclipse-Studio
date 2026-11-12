// Fish Drama 3 scenes: <|speaker:N|> turns, one voice each (speaker 0 is the chosen voice, the others come as `speakerVoiceIds`). Pure, so it is easy to test.
import type { AudioModel } from "./registry";

export function checkSpeakers(model: AudioModel, text: string, extraInput: unknown): { ok: true; extra: string[] } | { ok: false; error: string } {
  const extra = Array.isArray(extraInput) ? extraInput : [];
  if (extra.length) {
    if (!model.multiSpeaker) return { ok: false, error: `${model.label} takes one voice.` };
    if (extra.length + 1 > (model.maxSpeakers ?? 5) || !extra.every((v) => typeof v === "string" && /^[A-Za-z0-9_.-]{1,128}$/.test(v))) return { ok: false, error: `A scene can have up to ${model.maxSpeakers ?? 5} voices.` };
  }
  if (model.multiSpeaker) {
    const used = [...text.matchAll(/<\|speaker:(\d+)\|>/g)].map((x) => Number(x[1]));
    const need = used.length ? Math.max(...used) + 1 : 1;
    if (need > extra.length + 1) return { ok: false, error: `Your script uses speaker ${need - 1} but only ${extra.length + 1} voice${extra.length ? "s are" : " is"} chosen. Choose a voice for each speaker.` };
    if (extra.length && !used.length) return { ok: false, error: "Start each turn with a speaker tag, such as <|speaker:0|>, when a scene has more than one voice." };
    if (used.length && Buffer.byteLength(text, "utf8") > model.callChars) return { ok: false, error: `A scene can be up to ${model.callChars.toLocaleString("en-US")} bytes for now. Shorten it or split it into two takes.` };
  }
  return { ok: true, extra: extra as string[] };
}
