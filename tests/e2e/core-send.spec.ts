import { test, expect, type Page } from "@playwright/test";

// A message Core prepared for a connected app shows as a card; nothing is posted until Send is pressed.
async function seed(page: Page, status = "pending") {
  await page.addInitScript(() => {
    localStorage.setItem("eclipse-project", JSON.stringify({ id: "p1", name: "Demo" }));
    localStorage.setItem("eclipse-projects", JSON.stringify([{ id: "p1", name: "Demo", updatedAt: new Date().toISOString(), deletedAt: null }]));
  });
  await page.route("**/api/**", (r) => r.fulfill({ json: { items: [], renders: [], entries: [], balance: 0, models: [] } }));
  await page.route("**/api/connect/chats/c1", (r) => r.fulfill({ json: { id: "c1", title: "t", lines: [{ role: "user", parts: [{ kind: "text", text: "Post the launch note to Slack" }] }, { role: "assistant", parts: [{ kind: "text", text: "I prepared it. Press Send." }, { kind: "tool", name: "send_to_app" }, { kind: "send", id: "s1" }] }] } }));
  const posts: string[] = [];
  await page.route("**/api/connect/sends/s1", async (r) => {
    if (r.request().method() === "POST") {
      const body = r.request().postDataJSON();
      posts.push(body.action);
      await r.fulfill({ json: { status: body.action === "send" ? "sent" : "canceled", to: "#launch" } });
    } else await r.fulfill({ json: { id: "s1", app: "slack", appName: "Slack", destination: "#launch", text: "Launch is live. Thank you all.", hasPicture: true, status } });
  });
  return posts;
}

test.describe("Core sending needs a tap", () => {
  test("the card shows where it goes, nothing is sent by itself, and Send posts once", async ({ page }) => {
    const posts = await seed(page);
    await page.goto("/connect?chat=c1");
    const card = page.locator(".cn-sc");
    await expect(card).toContainText("Send to Slack (#launch)?");
    await expect(card).toContainText("Launch is live. Thank you all.");
    await expect(card).toContainText("A picture is attached");
    expect(posts).toEqual([]);
    await card.getByRole("button", { name: "Send", exact: true }).click();
    await expect(card).toContainText("Sent to Slack (#launch)");
    await expect(card.getByRole("button")).toHaveCount(0);
    expect(posts).toEqual(["send"]);
  });

  test("Cancel keeps it unsent, and an already-sent message shows no buttons", async ({ page, browser }) => {
    const posts = await seed(page);
    await page.goto("/connect?chat=c1");
    await page.locator(".cn-sc").getByRole("button", { name: "Cancel" }).click();
    await expect(page.locator(".cn-sc")).toContainText("Canceled: not sent to Slack (#launch)");
    expect(posts).toEqual(["cancel"]);
    const ctx = await browser.newContext();
    const p2 = await ctx.newPage();
    await seed(p2, "sent");
    await p2.goto("/connect?chat=c1");
    await expect(p2.locator(".cn-sc")).toContainText("Sent to Slack (#launch)");
    await expect(p2.locator(".cn-sc").getByRole("button")).toHaveCount(0);
    await ctx.close();
  });
});
