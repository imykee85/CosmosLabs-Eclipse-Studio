import { defineConfig } from "@playwright/test";

// Smoke tests against a production build in preview mode (no Clerk keys, so the demo login works). Locally and in CI: `npm run build` then `npm run test:e2e`.
// PLAYWRIGHT_CHROMIUM sets a browser path where the default download is not available.
const port = Number(process.env.E2E_PORT || 3100);
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 45_000,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${port}`,
    launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM || undefined, args: ["--no-proxy-server"] },
  },
  webServer: {
    command: `npx next start -p ${port}`,
    url: `http://localhost:${port}`,
    reuseExistingServer: !process.env.CI,
    env: { NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "", CLERK_SECRET_KEY: "" },
    timeout: 60_000,
  },
});
