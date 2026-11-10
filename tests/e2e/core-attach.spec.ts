import { test, expect, type Page } from "@playwright/test";

// Core: an attached picture and video show as tiles in the transcript (your side), each sent message has an edit button, and editing
// brings its words and files back into the box and cuts the thread back before it.
async function seed(page: Page, patched: { fromUser?: number }[]) {
  await page.addInitScript(() => {
    localStorage.setItem("eclipse-project", JSON.stringify({ id: "p1", name: "Demo" }));
    localStorage.setItem("eclipse-projects", JSON.stringify([{ id: "p1", name: "Demo", updatedAt: new Date().toISOString(), deletedAt: null }]));
  });
  await page.route("**/api/**", (r) => r.fulfill({ json: { items: [], renders: [], entries: [], balance: 0, models: [] } }));
  await page.route("**/api/connect/chats/c1", async (r) => {
    if (r.request().method() === "PATCH") { patched.push(r.request().postDataJSON()); return r.fulfill({ json: { ok: true } }); }
    await r.fulfill({ json: { id: "c1", title: "Sheet", lines: [
      { role: "user", parts: [
        { kind: "att", items: [{ type: "upload", id: "u1", label: "Character" }, { type: "video", id: "v1", label: "reference.mp4" }] },
        { kind: "text", text: "Make a sheet of him" },
      ] },
      { role: "assistant", parts: [{ kind: "text", text: "Which model?" }] },
    ] } });
  });
}

test.describe("Core attachments", () => {
  test.use({ viewport: { width: 520, height: 900 }, screen: { width: 390, height: 844 }, isMobile: true });

  test("sent pictures and videos show as tiles, and edit brings them back into the box", async ({ page }) => {
    const patched: { fromUser?: number }[] = [];
    await seed(page, patched);
    await page.goto("/connect?chat=c1");
    await expect(page.locator(".cn-att-tile")).toHaveCount(2);
    await expect(page.locator(".cn-att-tile.is-video")).toContainText("reference.mp4");
    await expect(page.locator(".cn-edit")).toHaveCount(1);
    await page.locator(".cn-edit").click();
    await expect.poll(() => patched.length).toBe(1);
    expect(patched[0]).toEqual({ fromUser: 1 });
    await expect(page.locator(".cn-box textarea")).toHaveValue("Make a sheet of him");
    await expect(page.locator(".cn-clip-tile")).toHaveAttribute("title", "reference.mp4");
    await expect(page.locator(".cn-msg.is-user")).toHaveCount(0);
  });
});
