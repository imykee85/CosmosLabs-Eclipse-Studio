import { test } from "node:test";
import assert from "node:assert/strict";
import { accepts, canWire, inPortsOf, inputsOf, listLines, naturalPort, outLabelOf, portFor } from "../../src/lib/canvas-flow";
import { alignDrag } from "../../src/lib/canvas-guides";
import { newNode, templateGraph, instantiate, type CNode } from "../../src/lib/canvas";

const node = (id: string, type: string, data: object = {}) => ({ id, type, position: { x: 0, y: 0 }, data }) as unknown as CNode;
const edge = (source: string, target: string, targetHandle: string) => ({ id: `${source}-${target}-${targetHandle}`, source, target, sourceHandle: "out", targetHandle });

test("text tools: Assistant and List give a description; audio nodes take one", () => {
  assert.equal(naturalPort("assistant"), "description");
  assert.equal(naturalPort("list"), "description");
  assert.equal(outLabelOf("assistant"), "Text");
  assert.deepEqual(inPortsOf("voiceover").map((p) => p.id), ["description"]);
  assert.equal(portFor("assistant", "generator"), "description");
  assert.equal(portFor("text", "assistant"), "description");
  assert.equal(accepts("assistant", "description"), true);
});

test("picture tools: one picture in Ingredients, a picture out", () => {
  assert.deepEqual(inPortsOf("upscaler").map((p) => p.id), ["ingredients"]);
  assert.deepEqual(inPortsOf("editor").map((p) => p.id), ["description", "ingredients"]);
  assert.equal(portFor("generator", "editor"), "ingredients");
  assert.equal(portFor("editor", "videogen"), "start", "an edited picture can be a video's start frame");
  assert.equal(portFor("editor", "upscaler"), "ingredients");
  assert.equal(outLabelOf("editor"), "Result");
});

test("sounds go to the video generator's Sounds port, and nowhere else", () => {
  assert.equal(portFor("voiceover", "videogen"), "sounds");
  assert.equal(accepts("sfx", "sounds"), true);
  assert.equal(accepts("music", "sounds"), true);
  assert.equal(accepts("text", "sounds"), false);
  assert.equal(accepts("voiceover", "ingredients"), false);
  assert.equal(portFor("voiceover", "generator"), null);
  const nodes = [node("v", "voiceover"), node("vg", "videogen"), node("g", "generator")];
  assert.equal(canWire(nodes, [], { source: "v", target: "vg", targetHandle: "sounds" }), true);
  assert.equal(canWire(nodes, [], { source: "v", target: "g", targetHandle: "ingredients" }), false);
});

test("a List hands over its lines; an audio node hands over its take", () => {
  assert.deepEqual(listLines("  red dress \n\n blue suit\r\ngreen coat  \n"), ["red dress", "blue suit", "green coat"]);
  const nodes = [node("l", "list", { text: "a\nb\n" }), node("g", "generator"), node("s", "sfx", { gens: ["a1"] }), node("vg", "videogen")];
  const edges = [edge("l", "g", "description"), edge("s", "vg", "sounds")];
  const gi = inputsOf(nodes, edges, "g");
  assert.deepEqual(gi[0].list, ["a", "b"]);
  assert.equal(gi[0].ready, true);
  const vi = inputsOf(nodes, edges, "vg");
  assert.deepEqual(vi[0].audio?.id, "a1");
  const empty = inputsOf([node("l", "list", { text: "" }), node("g", "generator")], [edge("l", "g", "description")], "g");
  assert.equal(empty[0].ready, false);
});

test("helper lines snap to a neighbour's edge or centre within the threshold only", () => {
  const near = alignDrag({ x: 103, y: 500, w: 100, h: 100 }, [{ x: 100, y: 0, w: 100, h: 100 }]);
  assert.equal(near.x, 100);
  assert.deepEqual(near.guides.x, [100]);
  assert.equal(near.y, 500, "too far on y: no snap");
  assert.deepEqual(near.guides.y, []);
  const centre = alignDrag({ x: 0, y: 0, w: 100, h: 100 }, [{ x: 40, y: 400, w: 220, h: 100 }]); // its centre line is x = 150: our right edge is 100, our centre 50
  assert.equal(centre.x, 0);
  const far = alignDrag({ x: 0, y: 0, w: 50, h: 50 }, [{ x: 500, y: 500, w: 50, h: 50 }]);
  assert.deepEqual(far.guides, { x: [], y: [] });
});

test("groups keep their size in templates and when used", () => {
  const g = newNode("group", { x: 10, y: 20 });
  g.width = 700; g.height = 450;
  const t = templateGraph([g, newNode("text", { x: 50, y: 60 })], []);
  const tg = t.nodes.find((n) => n.type === "group")!;
  assert.equal(tg.width, 700);
  assert.equal(tg.zIndex, -1);
  const used = instantiate({ id: "t", name: "t", nodes: t.nodes, edges: t.edges }, { x: 0, y: 0 });
  const ug = used.nodes.find((n) => n.type === "group")!;
  assert.equal(ug.width, 700);
  assert.equal(ug.height, 450);
});
