import { expect, test } from "@playwright/test";

// Design Studio's ShotMap chip saves the model to ShotMap's list, opens ShotMap and puts the model in a new scene.
test("ShotMap chip opens ShotMap with the model placed in the scene", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("eclipse-project", JSON.stringify({ id: "p1", name: "Demo" }));
    localStorage.setItem("eclipse-projects", JSON.stringify([{ id: "p1", name: "Demo", updatedAt: new Date().toISOString(), deletedAt: null }]));
  });
  await page.route("**/api/**", (r) => r.fulfill({ json: { items: [], renders: [], entries: [], balance: 100, models: [] } }));
  await page.route("**/api/design/3d**", (r) => r.fulfill({ json: { items: [{ id: "a", model: "m", modelLabel: "M", mode: "image", name: "Velvet chair", prompt: "", status: "completed", error: null, sizeBytes: 1, createdAt: new Date().toISOString(), fileUrl: "/shot-models/SheenChair.glb", inputs: [] }], models: [] } }));
  await page.goto("/design");
  await page.waitForSelector(".cr-tray.is-open");
  await page.getByRole("button", { name: "ShotMap", exact: true }).click();
  await expect(page).toHaveURL(/\/generate/);
  const dlg = page.getByRole("dialog", { name: "ShotMap" });
  await expect(dlg.getByRole("button", { name: /Velvet chair/ }).first()).toBeVisible({ timeout: 20000 });
  await expect(page).not.toHaveURL(/shotmap=/);
});
