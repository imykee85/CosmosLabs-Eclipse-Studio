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

test("the new nodes: Image, Video, Character sheet and Video generator", async () => {
  const { composePrompt, inputsOf } = await import("../../src/lib/canvas-flow");
  assert.equal(portFor("image", "generator"), "ingredients");
  assert.equal(portFor("image", "videogen"), "start", "a picture is the video's start frame by default");
  assert.equal(portFor("generator", "videogen"), "start");
  assert.equal(portFor("clip", "videogen"), "clips");
  assert.equal(portFor("clip", "generator"), null, "a clip never goes into an image generator");
  assert.equal(portFor("videogen", "videogen"), "clips");
  assert.ok(!inPortsOf("sheet").some((p) => p.id === "scene"));
  assert.deepEqual(inPortsOf("videogen").map((p) => p.id), ["description", "start", "ingredients", "clips"]);
  assert.equal(accepts("character", "start"), true);
  assert.equal(accepts("text", "clips"), false);
  const nodes = [
    { ...node("c", "clip"), data: { clip: { id: "v1", label: "walk" } } },
    { ...node("i", "image"), data: { ref: { type: "upload", id: "u1", label: "hero" } } },
    node("v", "videogen"),
  ] as unknown as CNode[];
  const edges = [edge("c", "v", "clips"), edge("i", "v", "start")];
  assert.equal(canWire(nodes, [], { source: "c", target: "v", targetHandle: "clips" }), true);
  assert.equal(canWire(nodes, [], { source: "c", target: "v", targetHandle: "ingredients" }), false);
  const ins = inputsOf(nodes, edges, "v");
  assert.equal(ins.find((x) => x.port === "start")?.pic?.id, "u1");
  assert.equal(ins.find((x) => x.port === "clips")?.clip?.id, "v1");
  assert.match(composePrompt("sheet", "a knight", [], [], 2000), /^a knight\. Character reference sheet/);
});
