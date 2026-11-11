import { expect, test } from "@playwright/test";

// The owner's rule: a prompt box holds every upload (up to 50) whatever the model takes; what the model can take is said at Generate, nothing is dropped.
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
for (const [path, label] of [["/create", "Image Studio"], ["/generate", "Video Studio"]] as const) {
  test(`${label} keeps all 7 pictures uploaded at once`, async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("eclipse-project", JSON.stringify({ id: "p1", name: "T" }));
      localStorage.setItem("eclipse-projects", JSON.stringify([{ id: "p1", name: "T", updatedAt: new Date().toISOString(), deletedAt: null }]));
      localStorage.setItem("eclipse-first-tour", "1"); localStorage.setItem("eclipse-welcome-offer", "1");
    });
    let n = 0;
    await page.route("**/api/**", (r) => r.fulfill({ json: { items: [], renders: [], entries: [], balance: 100 } }));
    await page.route("**/api/uploads", (r) => { if (r.request().method() !== "POST") return r.fulfill({ json: { items: [] } }); n++; r.fulfill({ json: { item: { id: `u${n}`, name: `pic ${n}`, kind: "asset", imageUrl: `/api/uploads/u${n}/file` } } }); });
    await page.goto(path);
    await page.locator("input[type=file][multiple]").first().setInputFiles(Array.from({ length: 7 }, (_, i) => ({ name: `p${i}.png`, mimeType: "image/png", buffer: PNG })));
    await expect(page.locator("[aria-label^='Remove ']")).toHaveCount(7);
  });
}
