import { gateFeature } from "@/lib/access";
import { NextResponse } from "next/server";
import { audioUser } from "@/lib/audio/route-helpers";
import { MAX_SAMPLE_BYTES, cloneOwnVoice } from "@/lib/audio/voices";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// Clone a voice from one short sample (multipart: provider, name, description?, consent=1, file). The sample is checked by its bytes, sent to the provider and not kept.
export async function POST(req: Request) {
  const gated = await gateFeature("studios"); // Audio Studio and Soul ID are part of the paid plans
  if (gated) return gated;
  const u = await audioUser();
  if ("res" in u) return u.res;
  let form: FormData;
  try { form = await req.formData(); } catch { return NextResponse.json({ error: "That upload could not be read. Use a recording under 4 MB." }, { status: 400 }); }
  const file = form.get("file");
  let sample: Uint8Array | null = null;
  if (file instanceof File) {
    if (file.size > MAX_SAMPLE_BYTES) return NextResponse.json({ error: "That recording is too large. Use a clip under 4 MB (about a minute of MP3)." }, { status: 413 });
    sample = new Uint8Array(await file.arrayBuffer());
  }
  const r = await cloneOwnVoice({ userId: u.userId, provider: form.get("provider"), name: form.get("name"), description: form.get("description"), consent: form.get("consent") === "1", sample });
  if (!r.ok) return NextResponse.json({ error: r.error, ...("code" in r && r.code ? { code: r.code } : {}) }, { status: r.status });
  return NextResponse.json({ voice: r.voice });
}
