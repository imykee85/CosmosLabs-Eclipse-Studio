import { z } from "zod";
import { db } from "@/lib/db";
import { headObjectInfo, signedMediaUrl, signedPutUrl, storageEnabled, storageHost } from "@/lib/storage";
import { kitFiles } from "../kit";
import { JobInputError, type KindDef } from "./types";

// media.scout: runs the owner's location-scout helper (location_refs.py, core/skills/builtin/location-scout) in a sandbox for Atlas. Two modes:
//  - search: looks up photo candidates on Wikimedia Commons for up to 6 phrases; the answer is a short list (title, creator, licence, link).
//  - pack: takes up to 12 exact Commons file titles (from an earlier search), downloads the originals, checks the licences, makes a contact sheet and a
//    credits file, and zips it all. The photos are NOT looked at by anyone, so the pack says "candidates" and never claims they were inspected.
// The sandbox may reach only Commons (search, pack) or the storage host (upload); nothing from a request reaches a command line except as a quoted argument.

const LINK_S = 30 * 60;
const COMMONS = ["commons.wikimedia.org", "upload.wikimedia.org"];
const REGISTRIES = ["pypi.org", "files.pythonhosted.org"];
const TITLE = /^File:[^\n\r|<>{}\\]{3,200}$/;

export const ScoutRequest = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("search"), queries: z.array(z.string().trim().min(2).max(100)).min(1).max(6), limit: z.number().int().min(3).max(20).optional() }).strict(),
  z.object({ mode: z.literal("pack"), name: z.string().trim().min(2).max(70), titles: z.array(z.string().regex(TITLE)).min(1).max(12), noShareAlike: z.boolean().optional() }).strict(),
]);
export type ScoutRequest = z.infer<typeof ScoutRequest>;

export const ScoutInput = z.object({ req: ScoutRequest, packKey: z.string().max(300).optional(), sheetKey: z.string().max(300).optional() }).strict();
export type ScoutInput = z.infer<typeof ScoutInput>;

export const scoutEnabled = () => Boolean(process.env.SANDBOX_PROVIDER) && storageEnabled;
const packCredits = () => (process.env.SANDBOX_CREDITS_SCOUT && Number(process.env.SANDBOX_CREDITS_SCOUT) >= 0 ? Math.floor(Number(process.env.SANDBOX_CREDITS_SCOUT)) : 0);

export function scoutInputFor(userId: string, jobId: string, body: unknown): ScoutInput {
  const parsed = ScoutRequest.safeParse(body);
  if (!parsed.success) throw new JobInputError(parsed.error.issues[0]?.message?.slice(0, 160) || "That scout request is not valid. Titles must be exact Commons titles like File:Name.jpg.");
  const req = parsed.data;
  return req.mode === "pack" ? { req, packKey: `u/${userId}/scout/${jobId}.zip`, sheetKey: `u/${userId}/scout/${jobId}-sheet.jpg` } : { req };
}

const SEARCH_SH = String.raw`#!/bin/bash
set -uo pipefail
LIMIT="$1"; shift
i=0
for q in "$@"; do python3 loc/location_refs.py search --query "$q" --limit "$LIMIT" --out "c$i.json" >/dev/null 2>&1 || true; i=$((i+1)); done
python3 - <<'PY'
import glob, json
seen, out = set(), []
for f in sorted(glob.glob("c*.json")):
    try: m = json.load(open(f))
    except Exception: continue
    for r in m.get("images", []):
        t = r.get("title")
        if not t or t in seen: continue
        seen.add(t)
        out.append({k: r.get(k) for k in ("title", "creator", "license", "source_page", "width", "height", "license_classification", "source_description")})
json.dump(out[:60], open("cands.json", "w"))
PY
`;

const SETUP_SH = String.raw`#!/bin/bash
set -euo pipefail
python3 -m pip install --user --quiet pillow
`;

// Titles go in a file; the helper resolves them to originals, downloads them (licences checked by the helper) and the sheet and credits are made here
// WITHOUT the helper's "inspected" claim: nobody looked at these photos yet.
const PACK_SH = String.raw`#!/bin/bash
set -euo pipefail
NAME="$1"; SA="$2"
python3 loc/location_refs.py resolve --titles-file titles.txt --out manifest.json
python3 - "$NAME" "$SA" <<'PY'
import json, sys, zipfile, importlib.util
from pathlib import Path
spec = importlib.util.spec_from_file_location("L", "loc/location_refs.py"); L = importlib.util.module_from_spec(spec); spec.loader.exec_module(L)
m = json.load(open("manifest.json")); m["name"] = sys.argv[1]; m["brief"] = "Candidate photographs from Wikimedia Commons. Nobody has inspected them yet: check the licence and the place before relying on any."
allow = sys.argv[2] != "no"
root = Path("pack"); L.download(m, root, allow)
m["status"] = "candidates-downloaded-uninspected"
L.make_sheet(m, root)
(root / "Sources.txt").write_text(L.credits_text(m), encoding="utf-8")
paths = [r["file"] for r in m["images"]] + ["Sources.txt", "Contact-Sheet.jpg"]
with zipfile.ZipFile("Reference-Pack.zip", "w", zipfile.ZIP_DEFLATED) as z:
    for rel in paths: z.write(root / rel, arcname=rel)
PY
cp pack/Contact-Sheet.jpg sheet.jpg
`;

const UPLOAD_SH = String.raw`#!/bin/bash
set -euo pipefail
curl -fsS --max-time 300 -X PUT -H "Content-Type: application/zip" --upload-file Reference-Pack.zip "$1" -o /dev/null
curl -fsS --max-time 120 -X PUT -H "Content-Type: image/jpeg" --upload-file sheet.jpg "$2" -o /dev/null
`;

const loc = () => kitFiles("location-scout", "loc", (r) => r === "scripts/location_refs.py").map((f) => ({ ...f, path: "loc/location_refs.py" }));

export const scout: KindDef<ScoutInput> = {
  kind: "media.scout",
  schema: ScoutInput,
  vcpus: 1,
  deadlineMs: 10 * 60_000,
  network: (i) => (i.req.mode === "search" ? { kind: "allowlist", domains: COMMONS } : { kind: "allowlist", domains: REGISTRIES }),
  base: "snapshot",
  price: (i) => (i.req.mode === "pack" ? packCredits() : 0),
  stageCount: (i) => (i.req.mode === "search" ? 1 : 3),
  stage: async (_ctx, i, input) => {
    const req = input.req;
    if (req.mode === "search") {
      return { name: "search", network: { kind: "allowlist", domains: COMMONS }, files: [...loc(), { path: "search.sh", content: Buffer.from(SEARCH_SH), mode: 0o755 }], cmd: "bash", args: ["search.sh", String(req.limit ?? 10), ...req.queries] };
    }
    if (i === 0) return { name: "setup", network: { kind: "allowlist", domains: REGISTRIES }, files: [...loc(), { path: "setup.sh", content: Buffer.from(SETUP_SH), mode: 0o755 }, { path: "pack.sh", content: Buffer.from(PACK_SH), mode: 0o755 }, { path: "upload.sh", content: Buffer.from(UPLOAD_SH), mode: 0o755 }, { path: "titles.txt", content: Buffer.from(req.titles.join("\n") + "\n") }], cmd: "bash", args: ["setup.sh"] };
    if (i === 1) return { name: "pack", network: { kind: "allowlist", domains: COMMONS }, cmd: "bash", args: ["pack.sh", req.name, req.noShareAlike ? "no" : "yes"] };
    const host = storageHost();
    return { name: "upload", network: host ? { kind: "allowlist", domains: [host] } : { kind: "none" }, cmd: "bash", args: ["upload.sh", await signedPutUrl(input.packKey!, "application/zip", LINK_S), await signedPutUrl(input.sheetKey!, "image/jpeg", LINK_S)], secretArgs: true };
  },
  collect: async (ctx, input) => {
    if (input.req.mode === "search") {
      const raw = await ctx.provider.readFile(ctx.name, "cands.json", 400_000).catch(() => null);
      let list: unknown[] = [];
      try { const j = JSON.parse(raw?.toString("utf8") ?? "[]"); if (Array.isArray(j)) list = j.slice(0, 60); } catch { /* none */ }
      if (!list.length) return { output: {}, failed: "No photos were found for those words. Try other words, a place name or a landmark." };
      return { output: { candidates: list } };
    }
    const zip = await headObjectInfo(input.packKey!), sheet = await headObjectInfo(input.sheetKey!);
    if (!zip?.size || !sheet?.size) return { output: {}, failed: "The photo pack was not saved." };
    const row = await db.upload.create({ data: { userId: ctx.job.userId, kind: "asset", name: `${input.req.name.slice(0, 60)} (contact sheet)`, projectId: null, storageKey: input.sheetKey!, contentType: "image/jpeg", sizeBytes: sheet.size, width: null, height: null } });
    return { output: { zipKey: input.packKey, sheetUploadId: row.id, sizeBytes: zip.size, photos: input.req.titles.length } };
  },
  failMessage: "The photo search could not run.",
  present: async (output) => {
    const key = typeof output.zipKey === "string" ? output.zipKey : null;
    return { ...output, zipKey: undefined, url: key ? await signedMediaUrl(key, { ttlSeconds: 3600, download: "reference-pack.zip", contentType: "application/zip" }) : null };
  },
};
