import { test } from "node:test";
import assert from "node:assert/strict";
import { accepts, canWire, inPortsOf, naturalPort, portFor, wouldLoop } from "../../src/lib/canvas-flow";
import type { CNode } from "../../src/lib/canvas";

const node = (id: string, type: string) => ({ id, type, position: { x: 0, y: 0 }, data: {} }) as unknown as CNode;
const edge = (source: string, target: string, targetHandle = "description") => ({ id: `${source}-${target}`, source, target, sourceHandle: "out", targetHandle });

test("each kind of node plugs into its own port", () => {
  assert.equal(naturalPort("text"), "description");
  assert.equal(naturalPort("style"), "style");
  assert.equal(portFor("character", "generator"), "character");
  assert.equal(accepts("text", "style"), false);
  assert.equal(accepts("note", "description"), false);
});

test("a picture can always go to Ingredients; the full-body generator has no Scene input", () => {
  assert.equal(accepts("scene", "ingredients"), true);
  assert.ok(!inPortsOf("fullbody").some((p) => p.id === "scene"));
  assert.equal(portFor("scene", "fullbody"), "ingredients");
});

test("wires never loop, repeat or run into themselves", () => {
  const nodes = [node("t", "text"), node("g1", "generator"), node("g2", "generator")];
  const edges = [edge("g1", "g2", "ingredients")];
  assert.equal(wouldLoop(edges, "g2", "g1"), true);
  assert.equal(canWire(nodes, edges, { source: "g2", target: "g1", targetHandle: "ingredients" }), false);
  assert.equal(canWire(nodes, edges, { source: "g1", target: "g2", targetHandle: "ingredients" }), false);
  assert.equal(canWire(nodes, edges, { source: "g1", target: "g1", targetHandle: "ingredients" }), false);
  assert.equal(canWire(nodes, edges, { source: "t", target: "g1", targetHandle: "description" }), true);
  assert.equal(canWire(nodes, edges, { source: "t", target: "t" }), false);
});
