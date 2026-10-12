"use client";

import { useEffect, useRef } from "react";

// The "One canvas" cloud. Each card is a flat picture mapped onto the four corners measured from the user's reference screenshot (a 2000 x 1500 stage),
// so the cards get the same skewed, perspective look: a homography turned into a CSS matrix3d. The stage is scaled to fit its box by a ResizeObserver.
type Pt = [number, number];
type Card = { label: string; alt: string; q: [Pt, Pt, Pt, Pt] }; // corners: top-left, top-right, bottom-right, bottom-left

const cards: Card[] = [
  { label: "Automotive", alt: "A model in a leather jacket sitting on a classic car at dusk", q: [[50, 167], [642, 193], [678, 520], [118, 570]] },
  { label: "Jewelry", alt: "A model with a statement necklace against a cloudy sky, reflected in glass", q: [[724, 72], [966, 54], [998, 375], [755, 399]] },
  { label: "Menswear", alt: "A man in a black jacket with a watch and sunglasses", q: [[1172, 135], [1435, 140], [1405, 408], [1153, 392]] },
  { label: "Editorial", alt: "A model in a red dress between sculpted hedges", q: [[1450, 250], [1968, 195], [1925, 615], [1420, 580]] },
  { label: "Interiors", alt: "A white boucle armchair in a calm, minimal room", q: [[145, 620], [373, 625], [373, 803], [147, 808]] },
  { label: "Fashion", alt: "A model in black evening wear in front of a red curtain", q: [[1615, 692], [1858, 672], [1868, 873], [1620, 878]] },
  { label: "Beauty", alt: "A model with braids and shell jewelry in still water", q: [[100, 845], [510, 885], [480, 1220], [25, 1230]] },
  { label: "Eyewear", alt: "A man in a green jacket putting on orange sport sunglasses", q: [[635, 982], [882, 1005], [843, 1350], [566, 1332]] },
  { label: "Products", alt: "A stack of four leather handbags in different colours", q: [[1057, 1040], [1250, 1025], [1275, 1292], [1080, 1305]] },
  { label: "Portrait", alt: "A woman in a black high-collar top against warm linen", q: [[1445, 950], [1790, 918], [1905, 1340], [1510, 1364]] },
];

const dist = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1]);

// Solve the 3 x 3 projective transform that maps a w x h rectangle onto the quad, as a CSS matrix3d.
function matrix3d(w: number, h: number, q: Card["q"]): string {
  const src: Pt[] = [[0, 0], [w, 0], [w, h], [0, h]];
  const A: number[][] = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = src[i];
    const [u, v] = q[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y, u]);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y, v]);
  }
  for (let c = 0; c < 8; c++) {
    let p = c;
    for (let r = c + 1; r < 8; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    [A[c], A[p]] = [A[p], A[c]];
    for (let r = 0; r < 8; r++) {
      if (r === c) continue;
      const f = A[r][c] / A[c][c];
      for (let k = c; k < 9; k++) A[r][k] -= f * A[c][k];
    }
  }
  const [a, b, cc, d, e, f, g, hh] = A.map((row, i) => row[8] / row[i]);
  return `matrix3d(${a},${d},0,${g},${b},${e},0,${hh},0,0,1,0,${cc},${f},0,1)`;
}

const laid = cards.map((c, i) => {
  const [tl, tr, br, bl] = c.q;
  const w = Math.round((dist(tl, tr) + dist(bl, br)) / 2);
  const h = Math.round((dist(tl, bl) + dist(tr, br)) / 2);
  const mx = (bl[0] + br[0]) / 2;
  const my = (bl[1] + br[1]) / 2;
  const angle = (Math.atan2(br[1] - bl[1], br[0] - bl[0]) * 180) / Math.PI;
  return { ...c, i, w, h, m: matrix3d(w, h, c.q), lx: Math.round(mx), ly: Math.round(my) + 5, angle: angle.toFixed(2) };
});

export default function CanvasCloud() {
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const fit = () => el.style.setProperty("--s", String(el.clientWidth / 2000));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="canvas-cloud" ref={box}>
      <div className="cc-stage">
        {laid.map((c) => (
          <figure className="cc-card" key={c.label} style={{ ["--w" as string]: `${c.w}px`, ["--h" as string]: `${c.h}px`, ["--m" as string]: c.m }}>
            <div className="cc-pic">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/canvas/c${c.i + 1}.jpg`} alt={c.alt} loading="lazy" decoding="async" />
            </div>
            <figcaption>{c.label}</figcaption>
          </figure>
        ))}
        {laid.map((c) => (
          <span className="cc-label" aria-hidden="true" key={c.label} style={{ left: c.lx, top: c.ly, transform: `translate(-50%, 0) rotate(${c.angle}deg)` }}>{c.label}</span>
        ))}
        <div className="cc-center">
          <h2 className="section-kicker kicker-center"><span>One canvas.</span><span><em>Endless</em> possibilities.</span></h2>
          <p>Portraits, products, interiors and campaigns, made and kept together in one studio.</p>
        </div>
      </div>
    </div>
  );
}
