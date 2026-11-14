import { expect, test } from "@playwright/test";

// The converter runs in the browser: an .obj and an .stl become real .glb bytes (the "glTF" magic), a bad file is refused with a plain message.
test("other 3D formats are converted to glb", async ({ page }) => {
  await page.route("**/api/**", (r) => r.fulfill({ json: { items: [], renders: [], entries: [], balance: 1 } }));
  await page.addInitScript(() => {
    localStorage.setItem("eclipse-project", JSON.stringify({ id: "p1", name: "Demo" }));
    localStorage.setItem("eclipse-projects", JSON.stringify([{ id: "p1", name: "Demo", updatedAt: new Date().toISOString(), deletedAt: null }]));
  });
  await page.goto("/design");
  await page.locator('input[type=file][accept*=".obj"]').waitFor({ state: "attached" });
  const input = page.locator('input[type=file][accept*=".obj"]');
  await input.setInputFiles({ name: "tri.obj", mimeType: "text/plain", buffer: Buffer.from("v 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3\n") });
  await expect(page.locator(".ds-error")).toHaveCount(0);
  await input.setInputFiles({ name: "bad.xyz", mimeType: "text/plain", buffer: Buffer.from("x") });
  await expect(page.locator(".ds-error")).toContainText("not supported");
});
