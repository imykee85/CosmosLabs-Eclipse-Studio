import { expect, test } from "@playwright/test";

// The Library's Design tab lists 3D models and motions together, with a filter and a link back into Design Studio.
test("Library Design tab shows 3D models and motions", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("eclipse-project", JSON.stringify({ id: "p1", name: "Demo" }));
    localStorage.setItem("eclipse-projects", JSON.stringify([{ id: "p1", name: "Demo", updatedAt: new Date().toISOString(), deletedAt: null }]));
  });
  await page.route("**/api/**", (r) => r.fulfill({ json: { items: [], renders: [] } }));
  await page.route("**/api/design/3d", (r) => r.fulfill({ json: { items: [{ id: "a", name: "Chair", modelLabel: "Meshy 7", status: "completed", createdAt: "2026-11-14T10:00:00Z", fileUrl: "/api/design/3d/a/file", prompt: "", inputs: [] }] } }));
  await page.route("**/api/design/motion", (r) => r.fulfill({ json: { items: [{ id: "m", title: "Logo sting", prompt: "x", aspect: "16:9", versions: 2, updatedAt: "2026-11-14T11:00:00Z", status: "done" }] } }));
  await page.goto("/library?kind=Design");
  await expect(page.getByText("Logo sting")).toBeVisible();
  await expect(page.getByText("Chair")).toBeVisible();
  await expect(page.getByRole("link", { name: "Open in Design Studio" }).first()).toHaveAttribute("href", /\/design\?tab=motion&open=m/);
  await page.getByRole("button", { name: "Motions" }).click();
  await expect(page.getByText("Chair")).toHaveCount(0);
});
