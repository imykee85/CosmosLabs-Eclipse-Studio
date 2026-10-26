// Alignment helper lines: while a node is dragged, its left, centre and right edges (and top, middle and bottom) snap to those of other nodes that are close,
// and a thin line shows what it lined up with.
export type Box = { x: number; y: number; w: number; h: number };
export type Guides = { x: number[]; y: number[] };

const spots = (a: number, size: number) => [a, a + size / 2, a + size];

/** Where the dragged box lands after snapping to the other boxes (within `threshold` flow pixels), and the guide lines to draw. */
export function alignDrag(dragged: Box, others: Box[], threshold = 6): { x: number; y: number; guides: Guides } {
  let dx = threshold + 1, dy = threshold + 1, gx: number | null = null, gy: number | null = null;
  for (const o of others) {
    for (const mine of spots(dragged.x, dragged.w)) for (const theirs of spots(o.x, o.w)) {
      const d = theirs - mine;
      if (Math.abs(d) < Math.abs(dx)) { dx = d; gx = theirs; }
    }
    for (const mine of spots(dragged.y, dragged.h)) for (const theirs of spots(o.y, o.h)) {
      const d = theirs - mine;
      if (Math.abs(d) < Math.abs(dy)) { dy = d; gy = theirs; }
    }
  }
  const snapX = Math.abs(dx) <= threshold, snapY = Math.abs(dy) <= threshold;
  return { x: dragged.x + (snapX ? dx : 0), y: dragged.y + (snapY ? dy : 0), guides: { x: snapX && gx != null ? [gx] : [], y: snapY && gy != null ? [gy] : [] } };
}
