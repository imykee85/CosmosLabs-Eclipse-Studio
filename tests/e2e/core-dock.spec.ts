import { test, expect } from "@playwright/test";

// Owner 2026-11-09: messages showed behind and beside the Core message box. The dock must cover everything between the thread and the tab bar.
test.describe("Core message box", () => {
  test.use({ viewport: { width: 520, height: 900 }, screen: { width: 390, height: 844 }, isMobile: true });

  test("nothing from the thread shows beside or under the box", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("eclipse-project", JSON.stringify({ id: "p1", name: "Demo" }));
      localStorage.setItem("eclipse-projects", JSON.stringify([{ id: "p1", name: "Demo", updatedAt: new Date().toISOString(), deletedAt: null }]));
      localStorage.setItem("eclipse-theme", "light");
    });
    await page.route("**/api/**", (r) => r.fulfill({ json: { items: [], renders: [], entries: [], balance: 0, models: [] } }));
    const long = "The earlier attempt still counts as running, so the system refuses a second edit until it ends. ".repeat(4);
    await page.route("**/api/connect/chats/c1", (r) => r.fulfill({ json: { id: "c1", title: "Long", lines: Array.from({ length: 8 }, (_, i) => ({ role: i % 2 ? "assistant" : "user", parts: [{ kind: "text", text: `${i + 1}. ${long}` }] })) } }));
    await page.goto("/connect?chat=c1");
    await page.locator(".cn-box").waitFor();
    await expect(page.locator(".cn-msg").first()).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => window.scrollTo(0, Math.floor(document.body.scrollHeight * 0.45)));
    await page.waitForTimeout(800); // layout and scroll settle before the pixels are read
    await page.screenshot({ path: process.env.DOCK_SHOT ?? "/tmp/dock.png" });
    // The strips just left and right of the box, and the gap under it, must show only the page colour (no message text or bubble).
    const rects = await page.evaluate(() => {
      const box = document.querySelector(".cn-box")!.getBoundingClientRect();
      const tabs = document.querySelector(".mb-tabs")?.getBoundingClientRect();
      const bottom = tabs ? Math.max(box.bottom + 2, tabs.top - 2) : box.bottom + 8;
      const r = (x: number, y: number, w: number, h: number) => ({ x: Math.max(0, Math.floor(x)), y: Math.floor(y), width: Math.max(2, Math.floor(w)), height: Math.max(2, Math.floor(h)) });
      return { left: r(2, box.top + 24, box.left - 4, 60), right: r(box.right + 2, box.top + 24, innerWidth - box.right - 4, 60), under: r(40, box.bottom + 2, innerWidth - 80, bottom - box.bottom - 2), bg: getComputedStyle(document.documentElement).backgroundColor };
    });
    const sharp = (await import("sharp")).default;
    const want = (rects.bg.match(/\d+/g) ?? []).slice(0, 3).map(Number);
    const worstOf = async (name: "left" | "right" | "under") => {
      const { data } = await sharp(await page.screenshot({ clip: rects[name] })).removeAlpha().raw().toBuffer({ resolveWithObject: true });
      let worst = 0;
      for (let i = 0; i < data.length; i += 3) for (let c = 0; c < 3; c++) worst = Math.max(worst, Math.abs(data[i + c] - want[c]));
      return worst;
    };
    for (const name of ["left", "right", "under"] as const) expect(await worstOf(name), `${name} strip differs from the page colour`).toBeLessThan(10);
    // Control: without the covering background the same check must see the thread, so it really tests something.
    await page.addStyleTag({ content: ".cn-chat.is-chatting .cn-dock::before { display: none !important; }" });
    const without = await Promise.all((["left", "right", "under"] as const).map(worstOf));
    expect(Math.max(...without), "the check can see the thread when the background is removed").toBeGreaterThan(30);
  });
});
