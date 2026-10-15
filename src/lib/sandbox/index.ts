import { FakeLocalProvider } from "./fake-local";
import type { SandboxProvider } from "./types";

// Which provider runs the sandboxes. Nothing is chosen yet: `SANDBOX_PROVIDER` (Config value) names it, and the real providers get
// added here one by one once the owner has chosen one and its price is recorded. Unset = Core's sandbox skills answer "not available".
let cached: SandboxProvider | null | undefined;
export function sandboxProvider(): SandboxProvider | null {
  if (cached !== undefined) return cached;
  const name = process.env.SANDBOX_PROVIDER;
  if (name === "fake-local" && process.env.NODE_ENV !== "production") cached = new FakeLocalProvider();
  else cached = null;
  return cached;
}
/** For tests: install a provider (or none). */
export function setSandboxProvider(p: SandboxProvider | null) { cached = p; }
export const sandboxAvailable = () => sandboxProvider() !== null;
