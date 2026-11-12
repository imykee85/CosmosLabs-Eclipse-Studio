import { expect, test } from "@playwright/test";

// A plan picked on the homepage is carried through sign-up and opens its checkout without another click.
test("homepage plan button remembers the plan and sends it to sign-up", async ({ page }) => {
  await page.goto("/");
  const link = page.locator(".plan-card", { hasText: "Growth" }).getByRole("link", { name: "Get started" });
  await expect(link).toHaveAttribute("href", "/sign-up?plan=growth");
  await link.click();
  await expect(page).toHaveURL(/\/sign-up\?plan=growth/);
  expect(await page.evaluate(() => localStorage.getItem("eclipse-pending-plan"))).toBe("growth");
});

test("start-plan opens the checkout for the remembered plan, or shows the reason", async ({ page }) => {
  const sent: unknown[] = [];
  await page.route("**/api/billing/checkout", (r) => { sent.push(JSON.parse(r.request().postData() || "{}")); r.fulfill({ status: 503, json: { error: "Payments are not set up yet." } }); });
  await page.addInitScript(() => { localStorage.setItem("eclipse-pending-plan", "scale"); localStorage.setItem("eclipse-pending-after", "onboarding"); });
  await page.goto("/start-plan");
  await expect(page.getByText("Payments are not set up yet.")).toBeVisible();
  // shown beside a link to Billing
  expect(sent).toEqual([{ planId: "scale", after: "onboarding" }]);
  expect(await page.evaluate(() => localStorage.getItem("eclipse-pending-plan"))).toBeNull();
});

test("start-plan with no plan goes to Billing", async ({ page }) => {
  await page.goto("/start-plan");
  await expect(page).toHaveURL(/\/settings\?tab=billing/);
});
