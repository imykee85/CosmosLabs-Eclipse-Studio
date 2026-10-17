import { buildBase, smoke } from "./base";
import { coreExec, toolRun } from "./core";
import { mux } from "./mux";
import type { KindDef } from "./types";

// Every kind of sandbox job. Core is not used for website builds (owner 2026-10-17): there is no "core.taste-build" kind.
const KINDS: Record<string, KindDef<never>> = {
  [mux.kind]: mux as unknown as KindDef<never>,
  [toolRun.kind]: toolRun as unknown as KindDef<never>,
  [coreExec.kind]: coreExec as unknown as KindDef<never>,
  [smoke.kind]: smoke as unknown as KindDef<never>,
  [buildBase.kind]: buildBase as unknown as KindDef<never>,
};

export function kindDef(kind: string): KindDef | null {
  return (KINDS[kind] as unknown as KindDef | undefined) ?? null;
}
export const PERSON_KINDS = ["media.mux", "core.tool.run"] as const; // what POST /api/sandbox/jobs accepts from a person (core.exec starts from Core's agent)
