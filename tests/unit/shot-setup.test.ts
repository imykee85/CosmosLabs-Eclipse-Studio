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

test("combined moves: pull back while orbiting, or one after the other; speed and angles change the path", () => {
  const base = { ...DEFAULT_SETUP, durationS: 8 };
  const both = buildScene({ ...base, preset: "pull-out", preset2: "orbit-360", combine: "together" }).cameras[0];
  const dist = (k: { pos: number[] }) => Math.hypot(k.pos[0], k.pos[2]);
  assert.ok(dist(both.keys[both.keys.length - 1]) > dist(both.keys[0]) + 2, "it gets further away");
  const ang = (k: { pos: number[] }) => Math.atan2(k.pos[0], k.pos[2]);
  assert.ok(Math.abs(Math.abs(ang(both.keys[Math.floor(both.keys.length / 2)]) - ang(both.keys[0])) ) > 0.5, "and swings round");
  const seq = buildScene({ ...base, preset: "push-in", preset2: "truck-right", combine: "then", split: 0.5 }).cameras[0];
  const mid = seq.keys[Math.floor(seq.keys.length / 2)], end = seq.keys[seq.keys.length - 1];
  assert.ok(Math.abs(mid.pos[0]) < 0.3 && end.pos[0] > 1, "slides sideways only in the second half");
  const slow = buildScene({ ...base, preset: "orbit-180", speed: 0.5 }).cameras[0], fast = buildScene({ ...base, preset: "orbit-180", speed: 2 }).cameras[0];
  assert.ok(Math.abs(ang(fast.keys[fast.keys.length - 1]) - ang(fast.keys[0])) !== Math.abs(ang(slow.keys[slow.keys.length - 1]) - ang(slow.keys[0])));
  const high = buildScene({ ...base, preset: "truck-left", vertical: 40, rotate: 90 }).cameras[0].keys[0];
  assert.ok(high.pos[1] > 3 && high.pos[0] > 3, "vertical raises it and rotate swings it round");
  assert.match(shotPrompt({ ...base, preset: "pull-out", preset2: "orbit-360" }), /pull out while orbit 360/);
  assert.equal(DEFAULT_SETUP.aspect, "1:1");
});

import { addCamera, camCount, editCam, removeCamera, totalS, MOVE_GROUPS, PRESETS as ALL_PRESETS } from "../../src/lib/shot/setup";
test("move groups cover every preset once, and extra cameras cut one after the other", () => {
  const ids = MOVE_GROUPS.flatMap((g) => g.options.map((o) => o.id)).sort();
  assert.deepEqual(ids, ALL_PRESETS.filter((p) => p.id !== "static").map((p) => p.id).sort());
  let s = addCamera({ ...DEFAULT_SETUP, durationS: 5 }); s = editCam(s, 1, { preset: "orbit-180", durationS: 4 });
  assert.equal(camCount(s), 2); assert.equal(totalS(s), 9);
  const sc = buildScene(s);
  assert.equal(sc.cameras.length, 2); assert.deepEqual(sc.shots.map((x) => [x.startS, x.endS]), [[0, 5], [5, 9]]);
  assert.ok(sc.cameras[1].keys[0].t >= 5 - 1e-9);
  assert.match(shotPrompt(s), /hard cut to camera 2 \(5 to 9 s\)/);
  assert.equal(camCount(removeCamera(s, 1)), 1);
  for (const p of ALL_PRESETS) { const sc2 = buildScene({ ...DEFAULT_SETUP, preset: p.id }); assert.ok(sc2.cameras[0].keys.length >= 1); }
});

import { setupFromRebuild } from "../../src/lib/shot/rebuild";
test("a rebuilt scene is cleaned: valid poses, clamped places, a driver rides the car, junk dropped", () => {
  const s = setupFromRebuild({
    set: "street",
    people: [{ build: "woman", x: 99, z: 1, pose: "dancing", then: [{ pose: "sitting", at: 4 }, { pose: "walking", at: 9 }], moves: true, to_x: 3, to_z: 5 }, { build: "man", x: 0, z: 0, pose: "driving", rides_vehicle: 1 }],
    vehicles: [{ type: "sports", x: 0, z: 2, moves: true, to_x: 20, to_z: 2 }],
    objects: [{ type: "tree", x: -3, z: -5, rot: 400, scale: 9 }, { type: "spaceship", x: 0, z: 0 }],
    lens_mm: 500, distance: 0, vertical: 5,
  });
  assert.equal(s.kit, "street");
  const people = s.cast.filter((c) => c.kind === "person");
  assert.equal(people[0].x, 12); assert.equal(people[0].pose, "standing"); assert.equal(people[0].pose2, "sitting"); assert.equal(people[0].extra?.[0].pose, "walking");
  assert.equal(people[1].rides, "rv1"); assert.equal(people[1].pose, "driving");
  assert.equal(s.objects?.length, 1); assert.equal(s.objects?.[0].rot, 359); assert.equal(s.objects?.[0].scale, 2);
  assert.equal(s.lensMm, 135); assert.equal(s.distance, 1.5);
  assert.doesNotThrow(() => buildScene(s));
  assert.equal(new Set(s.cast.map((c) => c.color)).size, s.cast.length);
  assert.doesNotThrow(() => buildScene(setupFromRebuild(null)));
});

test("a seated person is placed on their seat and the seat keeps its own size", () => {
  const s = setupFromRebuild({ set: "room", people: [{ build: "man", x: 0.4, z: 0.3, pose: "sitting" }], objects: [{ type: "chair", x: 0, z: 0, rot: 0, scale: 1.8 }, { type: "table", x: 3, z: 0 }] });
  const p = s.cast.find((c) => c.kind === "person")!, chair = s.objects!.find((o) => o.type === "chair")!;
  assert.equal(chair.scale, 1); assert.ok(Math.hypot(p.x - chair.x, p.z - chair.z) < 0.1);
  assert.equal(s.objects!.find((o) => o.type === "table")!.scale, 1);
});
