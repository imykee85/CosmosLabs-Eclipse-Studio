import { randomInt } from "node:crypto";
import type { SeedSpec } from "./models";

export const randomSeed = (spec: SeedSpec): number => randomInt(spec.min, spec.max + 1);
export const seedInRange = (spec: SeedSpec, n: unknown): n is number => typeof n === "number" && Number.isInteger(n) && n >= spec.min && n <= spec.max;
