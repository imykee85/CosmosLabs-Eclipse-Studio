// A motion written the way the agent writes one: kinetic typography with per-letter animation, shapes and an end card.
const { W, H } = M;
const words = ["GO", "BEYOND", "EVERY STEP"];
const dots = Array.from({ length: 40 }, (_, i) => ({ x: M.rand(i) * W, y: M.rand(i + 99) * H, r: M.rand(i + 7, 2, 7) }));
return {
  background: "#0f4c5c",
  render(g, t) {
    for (const d of dots) { g.fillStyle = M.rgba("#e8d9c4", 0.25); g.beginPath(); g.arc(d.x, (d.y - t * 40) % H, d.r, 0, Math.PI * 2); g.fill(); }
    const i = Math.min(2, Math.floor(t / 2));
    const k = M.prog(t, i * 2, i * 2 + 0.6, "outExpo");
    const size = Math.min(300, (W * 0.8) / Math.max(2, words[i].length) * 1.6);
    M.letters(g, words[i], W / 2, H / 2 + size * 0.35, { size, weight: 800, align: "center", color: "#e8d9c4", tracking: 4 },
      (j, n) => { const e = M.prog(t, i * 2 + j * 0.05, i * 2 + 0.5 + j * 0.05, "outBack"); return { dy: (1 - e) * 120, alpha: e, scale: 0.6 + 0.4 * e }; });
    g.fillStyle = "#c00707"; M.roundRect(g, W / 2 - 200 * k, H * 0.72, 400 * k, 10, 5); g.fill();
    if (t > 5.2) M.text(g, "MAKE YOUR NEXT MOVE.", W / 2, H * 0.85, { size: 48, weight: 600, align: "center", color: "#ffffff", alpha: M.prog(t, 5.2, 5.8) });
  },
};
