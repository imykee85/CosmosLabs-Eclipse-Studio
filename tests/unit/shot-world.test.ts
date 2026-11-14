import test from "node:test";
import assert from "node:assert/strict";
import {
  addCamera, addItem, addShot, cameraAt, cameraOf, easeFn, editCameraKey, emptyWorld, fovFor, itemAt, moveCameraKey, readWorld, removeCameraKey,
  sampleKeys, setCameraKey, setItemKey, shotOf, splitShot, worldPrompt, worldRefs, MAX_SHOT_S,
} from "../../src/lib/shot/world";
import { applyAsk, worldDigest } from "../../src/lib/shot/ask";
import { TEMPLATES } from "../../src/lib/shot/world-store";
import { recordSize, frameCount } from "../../src/lib/shot/world-record";

const two = () => {
  let w = emptyWorld();
  w = setCameraKey(w, "cam1", { t: 10, pos: [10, 3, 0], look: [0, 1, 0], lensMm: 85, fStop: 2.8, focusM: 10, ease: "linear" }).world;
  return w;
};

test("eases start at 0, end at 1 and stay in order", () => {
  for (const e of ["smooth", "linear", "in", "out", "inout"] as const) {
    assert.equal(easeFn(e, 0), 0); assert.equal(easeFn(e, 1), 1);
    let prev = 0; for (let k = 0.05; k <= 1; k += 0.05) { const v = easeFn(e, k); assert.ok(v >= prev - 1e-9, `${e} goes back at ${k}`); prev = v; }
  }
  assert.ok(easeFn("in", 0.5) < 0.5 && easeFn("out", 0.5) > 0.5);
});

test("camera keys: linear goes straight, the arriving key's ease decides, ends hold", () => {
  const w = two(), cam = cameraOf(w);
  assert.deepEqual(cameraAt(w, cam, 0).key.pos, [0, 1.6, 7]);
  assert.deepEqual(cameraAt(w, cam, 12).key.pos, [10, 3, 0]);
  const mid = cameraAt(w, cam, 5).key;
  assert.ok(Math.abs(mid.pos[0] - 5) < 1e-6 && Math.abs(mid.lensMm - 60) < 1e-6, "linear halfway");
  const eased = editCameraKey(w, "cam1", 1, { ease: "in" }), m2 = cameraAt(eased, cameraOf(eased), 5).key;
  assert.ok(m2.pos[0] < 2, "ease in starts slowly");
  assert.deepEqual(sampleKeys([], 1), []);
});

test("keys stay sorted, replace within 0.05 s, move and delete; a camera keeps one key", () => {
  let w = two();
  const r = setCameraKey(w, "cam1", { ...cameraOf(w).keys[0], t: 4 }); w = r.world;
  assert.equal(r.index, 1); assert.deepEqual(cameraOf(w).keys.map((k) => k.t), [0, 4, 10]);
  w = setCameraKey(w, "cam1", { ...cameraOf(w).keys[0], t: 4.03, lensMm: 50 }).world;
  assert.deepEqual(cameraOf(w).keys.map((k) => k.t), [0, 4.03, 10]);
  w = moveCameraKey(w, "cam1", 1, 12); assert.deepEqual(cameraOf(w).keys.map((k) => k.t), [0, 10, 12]);
  assert.equal(moveCameraKey(w, "cam1", 1, 12.02), w, "cannot land on another key");
  w = removeCameraKey(w, "cam1", 2); w = removeCameraKey(w, "cam1", 1);
  assert.equal(removeCameraKey(w, "cam1", 0), w);
});

test("splitting a shot keeps the move: the second shot starts where the first ended", () => {
  const w = two(), at = cameraAt(w, cameraOf(w), 4).key, s = splitShot(w, 4);
  assert.equal(s.shots.length, 2); assert.equal(s.shots[0].durationS, 4); assert.equal(s.shots[1].durationS, 6);
  const c2 = cameraOf(s, s.shots[1].cameraId);
  assert.ok(Math.hypot(c2.keys[0].pos[0] - at.pos[0], c2.keys[0].pos[2] - at.pos[2]) < 1e-6);
  assert.equal(c2.keys[c2.keys.length - 1].t, 6);
  assert.equal(splitShot(w, 0.2), w, "too close to the start");
});

test("new cameras get their own shot; lens to field of view follows the frame", () => {
  const m = addCamera(emptyWorld()); const w = addShot(m.world, m.id);
  assert.equal(shotOf(w).cameraId, m.id);
  assert.ok(fovFor(14, "16:9") > fovFor(85, "16:9"));
  assert.ok(Math.abs(fovFor(50, "16:9") - 22.9) < 0.5, "50 mm on a 16:9 frame");
  assert.ok(fovFor(35, "9:16") > fovFor(35, "16:9"), "a tall frame sees more height");
});

test("people walk between their keys and face where they go", () => {
  let w = emptyWorld(); const a = addItem(w, { kind: "person", build: "man" }, [0, 0, 0]); w = a.world;
  w = setItemKey(w, a.id, { t: 0, pos: [0, 0, 0], yaw: 0, ease: "linear" });
  w = setItemKey(w, a.id, { t: 4, pos: [6, 0, 0], yaw: 0, ease: "linear" });
  const it = w.items.find((i) => i.id === a.id)!, now = itemAt(it, 2);
  assert.equal(now.pose, "walking"); assert.ok(Math.abs(now.pos[0] - 3) < 1e-6); assert.ok(Math.abs(now.yaw - 90) < 1);
  assert.equal(itemAt(it, 6).pose, "standing");
});

test("prompt names the guide, people by colour or picture, and the shot length; refs are linked characters", () => {
  let w = two(); const a = addItem(w, { kind: "person", character: { id: "u1", url: "/x", name: "Ada" } }); w = a.world;
  const p = worldPrompt(w);
  assert.match(p, /video 1 as the camera-motion reference/); assert.match(p, /first 10 seconds/); assert.match(p, /the person in image 1/);
  assert.deepEqual(worldRefs(w).map((r) => r.id), ["u1"]);
  assert.doesNotMatch(p, /Higgsfield|Magnific/i);
});

test("saved scenes read back; broken ones give null; templates are valid", () => {
  const w = two(); assert.deepEqual(readWorld(JSON.parse(JSON.stringify(w))), w);
  assert.equal(readWorld({ v: 1 }), null); assert.equal(readWorld(null), null);
  for (const t of TEMPLATES) { const x = t.make(); assert.ok(readWorld(JSON.parse(JSON.stringify(x))), `${t.id} valid`); assert.ok(cameraOf(x).keys.length >= 2); }
});

test("assistant answers are cleaned: unknown kinds and ids ignored, numbers clamped, the floor stays", () => {
  const w = emptyWorld();
  const r = applyAsk(w, {
    summary: "Built it", name: "Alps", prompt: "Mountains", sky: "#112233", ground: "nope",
    add: [{ kind: "shape", shape: "cone", name: "Summit", x: 0, z: -40, size_x: 60, size_y: 45, size_z: 60, group: "Peaks" }, { kind: "dragon", x: 0, z: 0 }, { kind: "person", build: "woman", x: 9999, y: 45, z: -40, pose: "sitting" }],
    remove: ["floor", "nothing"], camera_keys: [{ t: 0, x: 0, y: 6, z: 30, look_x: 0, look_y: 10, look_z: -20, lens_mm: 24 }, { t: 99, x: 0, y: 40, z: -30, look_x: 0, look_y: 45, look_z: -40, ease: "linear" }], duration_s: 14,
  }, "build");
  const items = r.world.items;
  assert.equal(r.added, 2); assert.equal(r.removed, 0); assert.ok(items.some((i) => i.id === "floor"));
  const cone = items.find((i) => i.name === "Summit")!; assert.deepEqual(cone.scale, [60, 45, 60]); assert.equal(r.world.groups[0].name, "Peaks"); assert.equal(cone.groupId, r.world.groups[0].id);
  const woman = items.find((i) => i.kind === "person")!; assert.equal(woman.pos[0], 150); assert.equal(woman.pos[1], 45); assert.equal(woman.pose, "sitting");
  assert.equal(r.world.name, "Alps"); assert.equal(r.world.sky, "#112233"); assert.equal(r.world.ground, w.ground);
  assert.equal(shotOf(r.world).durationS, 14); assert.deepEqual(cameraOf(r.world).keys.map((k) => k.t), [0, 14]);
  assert.ok(readWorld(JSON.parse(JSON.stringify(r.world))), "result is a valid scene");
  const u = applyAsk(r.world, { update: [{ id: cone.id, x: 5, color: "#ff0000" }, { id: "ghost", x: 1 }], remove: [woman.id] }, "scene");
  assert.equal(u.changed, 1); assert.equal(u.removed, 1); assert.equal(u.world.items.find((i) => i.id === cone.id)!.pos[0], 5);
  assert.match(worldDigest(u.world), /Summit/);
  assert.equal(applyAsk(w, null, "scene").world, w);
  assert.ok(MAX_SHOT_S >= 30);
});

test("recording size keeps the aspect ratio with even sides; frames follow the shot length", () => {
  assert.deepEqual(recordSize("16:9", "720p"), { w: 1280, h: 720 });
  assert.deepEqual(recordSize("9:16", "480p"), { w: 480, h: 854 });
  assert.deepEqual(recordSize("21:9", "480p"), { w: 1120, h: 480 });
  assert.equal(frameCount(two()), 240);
});
