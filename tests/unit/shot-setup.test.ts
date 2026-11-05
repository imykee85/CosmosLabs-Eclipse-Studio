import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_SETUP, PRESETS, addPerson, addVehicleWithDriver, buildScene, nextColor, removeCast, MAX_CAST, type Setup } from "../../src/lib/shot/setup";
import { cameraAt } from "../../src/lib/shot/engine";
import { shotPrompt } from "../../src/lib/shot/prompt";

test("every preset makes a valid scene whose camera never jumps", () => {
  for (const p of PRESETS) {
    const s: Setup = { ...DEFAULT_SETUP, preset: p.id }; const scene = buildScene(s), cam = scene.cameras[0];
    let prev = cameraAt(scene, cam, 0, "16:9").pos;
    for (let t = 0.1; t <= s.durationS; t += 0.1) { const c = cameraAt(scene, { ...cam, shake: { ...cam.shake, amount: 0 } }, t, "16:9").pos; assert.ok(Math.hypot(c[0] - prev[0], c[1] - prev[1], c[2] - prev[2]) < 1.6, `${p.id} jumps at ${t}`); prev = c; }
  }
});
test("orbit keeps its distance to the subject; push-in gets closer; shin height is low and wide", () => {
  const o = buildScene({ ...DEFAULT_SETUP, preset: "orbit-180" }), cam = o.cameras[0];
  for (const t of [0, 2, 4, 6, 8]) { const c = cameraAt(o, { ...cam, shake: { ...cam.shake, amount: 0 } }, t, "16:9").pos; assert.ok(Math.abs(Math.hypot(c[0], c[2]) - 4) < 0.25, "orbit radius at " + t); }
  const p = buildScene({ ...DEFAULT_SETUP, preset: "push-in" }); assert.ok(p.cameras[0].keys[1].pos[2] < p.cameras[0].keys[0].pos[2]);
  const sh = buildScene({ ...DEFAULT_SETUP, preset: "shin" }).cameras[0].keys[0]; assert.ok(sh.pos[1] < 0.3 && sh.lensMm === 15);
});
test("people and vehicles get their own colour, vehicles bring a driver, removing a vehicle removes its driver", () => {
  let s = addPerson(DEFAULT_SETUP); s = addVehicleWithDriver(s);
  assert.equal(new Set(s.cast.map((m) => m.color)).size, s.cast.length);
  const scene = buildScene({ ...s, preset: "follow" }); assert.ok(scene.vehicles.length === 1 && scene.actors.some((a) => a.parentId));
  const v = s.cast.find((m) => m.kind === "vehicle")!; assert.equal(removeCast(s, v.id).cast.some((m) => m.rides), false);
});
test("the cast stops at the limit and colours run out safely", () => {
  let s = DEFAULT_SETUP; for (let i = 0; i < 20; i++) s = addPerson(s);
  assert.ok(s.cast.length <= MAX_CAST); assert.ok(nextColor(s.cast) === null || s.cast.length < MAX_CAST);
});
test("a pose change and a walk end up in the scene", () => {
  const s: Setup = { ...DEFAULT_SETUP, cast: [{ ...DEFAULT_SETUP.cast[0], moves: true, toX: 2, toZ: 4, pose2: "sitting", pose2At: 4 }] };
  const a = buildScene(s).actors[0]; assert.equal(a.marks.length, 2); assert.deepEqual(a.actions.map((x) => x.pose), ["standing", "sitting"]);
});
test("the prompt names the guide, the stand-in rule, the camera and each colour", () => {
  const s: Setup = { ...DEFAULT_SETUP, preset: "handheld", shake: 0.5, cast: [{ ...DEFAULT_SETUP.cast[0], label: "a barista in her thirties", pose2: "squatting", pose2At: 3 }] };
  const p = shotPrompt(s, { look: "rooftop at dusk" });
  assert.match(p, /video 1/); assert.match(p, /stand-ins/); assert.match(p, /35 mm/); assert.match(p, /red figure is a barista in her thirties; squatting from 3 s/); assert.match(p, /rooftop at dusk/);
  assert.equal(shotPrompt(s), shotPrompt(s));
});

test("a person can be a man or a woman; the prompt and the scene say so", () => {
  const s: Setup = { ...DEFAULT_SETUP, cast: [{ ...DEFAULT_SETUP.cast[0], build: "woman" }] };
  const a = buildScene(s).actors[0]; assert.equal(a.build, "woman"); assert.ok(a.heightM < 1.7);
  assert.match(shotPrompt(s), /red figure is a woman/); assert.match(shotPrompt({ ...s, cast: [{ ...s.cast[0], build: "man" }] }), /red figure is a man/);
});

import { addObject, objectProps, OBJECTS, MAX_OBJECTS } from "../../src/lib/shot/setup";
test("objects become props in the scene and the prompt, and turn with their rotation", () => {
  let s = addObject(DEFAULT_SETUP, "table"); s = addObject(s, "horse");
  const sc = buildScene(s);
  assert.ok(sc.set.props.length >= 12);
  assert.ok(OBJECTS.length >= 16);
  const t = { id: "ox", type: "chair" as const, x: 1, z: 1, rot: 90, scale: 1 };
  const back = objectProps(t).find((p) => p.size[1] === 0.55)!; // chair back sits at local z -0.2 -> world x -0.2 after a quarter turn
  assert.ok(Math.abs(back.pos[0] - (1 - 0.2)) < 1e-9 || Math.abs(back.pos[0] - (1 + 0.2)) < 1e-9);
  assert.match(shotPrompt(s), /table, horse/);
  let many = DEFAULT_SETUP; for (let i = 0; i < MAX_OBJECTS + 3; i++) many = addObject(many, "crate");
  assert.equal((many.objects ?? []).length, MAX_OBJECTS);
});
test("several pose changes are all in the actor's actions, in time order", () => {
  const m = { ...DEFAULT_SETUP.cast[0], pose: "sitting" as const, pose2: "standing" as const, pose2At: 2, extra: [{ pose: "running" as const, at: 6 }, { pose: "walking" as const, at: 4 }] };
  const sc = buildScene({ ...DEFAULT_SETUP, durationS: 8, cast: [m] });
  assert.deepEqual(sc.actors[0].actions.map((a) => a.pose), ["sitting", "standing", "walking", "running"]);
});
