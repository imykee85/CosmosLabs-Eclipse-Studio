"use client";

import { useEffect, useRef } from "react";
import { ELEV_MAX, ELEV_MIN, INTENSITY_MAX, type Light } from "@/lib/relight/prompt";

type Props = {
  thumb: string; lights: Light[]; sel: number;
  onSelect: (i: number) => void;
  onMove: (index: number, patch: { rotate: number; elevation: number }) => void;
  onFail: () => void;
};

const R = 2.2; // how far the lamps stand from the picture
const CY = 0.8; // height of the picture's centre
const rad = (d: number) => (d * Math.PI) / 180;
const place = (rotate: number, elevation: number) => [-R * Math.sin(rad(rotate)) * Math.cos(rad(elevation)), CY + R * Math.sin(rad(elevation)), R * Math.cos(rad(rotate)) * Math.cos(rad(elevation))] as const;
const SMOOTH = 0.16; // how fast a lamp glides to its new place (share of the remaining distance per frame)

/** The light preview: the picture stands on a floor and is really lit by lamps you place. Each lamp is a small fixture aimed at the picture with a
 * visible beam, the picture casts a shadow, and a lamp glides smoothly to its new place when you tap a quick placement or move a slider. */
export default function ThreeLight({ thumb, lights, sel, onSelect, onMove, onFail }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const api = useRef<{ update: (ls: Light[], s: number) => void } | null>(null);
  const latest = useRef({ lights, sel, onSelect, onMove });
  latest.current = { lights, sel, onSelect, onMove };

  useEffect(() => {
    let disposed = false;
    let cleanup = () => {};
    (async () => {
      try {
        const T = await import("three");
        const el = host.current;
        if (disposed || !el) return;
        const renderer = new T.WebGLRenderer({ antialias: true, powerPreference: "low-power" });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = T.PCFSoftShadowMap;
        // the scene takes the app theme: the stage colour is read from the page, and the floor grid is drawn lighter or darker to match
        const stage = getComputedStyle(el).getPropertyValue("--a-input").trim() || "#0d0d10";
        let bg = new T.Color(0x0d0d10);
        try { bg = new T.Color(stage); } catch { /* keep the dark default */ }
        const dark = bg.r * 0.299 + bg.g * 0.587 + bg.b * 0.114 < 0.5;
        renderer.setClearColor(bg, 1);
        el.appendChild(renderer.domElement);
        renderer.domElement.style.cssText = "display:block;width:100%;height:100%;touch-action:none;";

        const scene = new T.Scene();
        const camera = new T.PerspectiveCamera(38, 1.25, 0.1, 60);
        scene.add(new T.AmbientLight(0xffffff, 0.3));

        const grid = new T.GridHelper(12, 24, dark ? 0x4a5080 : 0x9a9aa8, dark ? 0x2a2e4a : 0xc4c4cf);
        (grid.material as import("three").Material).transparent = true;
        (grid.material as import("three").Material).opacity = 0.65;
        scene.add(grid);
        // the floor catches the picture's shadow
        const floor = new T.Mesh(new T.PlaneGeometry(12, 12), new T.ShadowMaterial({ opacity: dark ? 0.55 : 0.3 }));
        floor.rotation.x = -Math.PI / 2; floor.position.y = 0.002; floor.receiveShadow = true;
        scene.add(floor);

        // the picture: a standing card that reacts to the light
        const mat = new T.MeshStandardMaterial({ color: 0x555555, roughness: 0.85, metalness: 0, side: T.DoubleSide });
        const card = new T.Mesh(new T.PlaneGeometry(1, 1), mat);
        card.castShadow = true; card.receiveShadow = true;
        scene.add(card);
        const setCard = (w: number, h: number) => { const k = 1.7 / Math.max(w, h); card.scale.set(w * k, h * k, 1); card.position.set(0, (h * k) / 2, 0); };
        setCard(1, 1);
        new T.TextureLoader().load(thumb, (tex) => {
          tex.colorSpace = T.SRGBColorSpace;
          mat.map = tex; mat.color.set(0xffffff); mat.needsUpdate = true;
          const im = tex.image as { width: number; height: number };
          setCard(im.width || 1, im.height || 1);
          kick();
        });

        // a lamp: a small fixture aimed at the picture, a lens in the light's colour, a real spotlight and a visible beam
        const target = new T.Object3D(); target.position.set(0, CY, 0); scene.add(target);
        type Lamp = { rotate: number; elevation: number; group: import("three").Group; lens: import("three").Mesh; spot: import("three").SpotLight; beam: import("three").Mesh; hit: import("three").Mesh };
        const lamps: Lamp[] = [];
        const bodyGeo = new T.CylinderGeometry(0.1, 0.2, 0.34, 24);
        const lensGeo = new T.CircleGeometry(0.17, 24);
        const capGeo = new T.CylinderGeometry(0.08, 0.1, 0.12, 16);
        const beamGeo = new T.ConeGeometry(0.5, 1, 32, 1, true);
        const makeLamp = (): Lamp => {
          const group = new T.Group();
          // built pointing along +z (towards the picture): lens at the front
          const body = new T.Mesh(bodyGeo, new T.MeshStandardMaterial({ color: 0x2b2b30, roughness: 0.5, metalness: 0.4 }));
          body.rotation.x = Math.PI / 2; body.castShadow = false;
          const cap = new T.Mesh(capGeo, new T.MeshStandardMaterial({ color: 0x1c1c20, roughness: 0.6 }));
          cap.rotation.x = Math.PI / 2; cap.position.z = -0.22;
          const lens = new T.Mesh(lensGeo, new T.MeshBasicMaterial({ color: 0xffffff, side: T.DoubleSide }));
          lens.position.z = 0.172;
          const hit = new T.Mesh(new T.SphereGeometry(0.34, 12, 8), new T.MeshBasicMaterial({ visible: false })); // the easy-to-grab area
          group.add(body, cap, lens, hit);
          const spot = new T.SpotLight(0xffffff, 40, 0, rad(32), 0.6, 1.2);
          spot.castShadow = true; spot.shadow.mapSize.set(512, 512); spot.shadow.bias = -0.0005;
          spot.target = target;
          const beam = new T.Mesh(beamGeo, new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.14, depthWrite: false, side: T.DoubleSide }));
          scene.add(group, spot, beam);
          return { rotate: 0, elevation: 0, group, lens, spot, beam, hit };
        };
        const removeLamp = (l: Lamp) => {
          scene.remove(l.group, l.spot, l.beam); l.spot.dispose();
          l.group.traverse((o) => { const m = o as import("three").Mesh; m.material && (m.material as import("three").Material).dispose?.(); });
          (l.beam.material as import("three").Material).dispose();
        };

        let goal: Light[] = [];
        let sel0 = 0;
        const shortest = (from: number, to: number) => ((to - from + 540) % 360) - 180;
        function pose(l: Lamp, light: Light, selected: boolean) {
          const [x, y, z] = place(l.rotate, l.elevation);
          l.group.position.set(x, y, z);
          l.group.lookAt(0, CY, 0);
          l.group.scale.setScalar(selected ? 1.15 : 1);
          l.spot.position.set(x, y, z);
          // the beam: a cone from the lamp to the picture's centre
          const len = Math.hypot(x, y - CY, z);
          l.beam.scale.set(1, len, 1);
          l.beam.position.set(x / 2, CY + (y - CY) / 2, z / 2);
          l.beam.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), new T.Vector3(x, y - CY, z).normalize()); // the cone's tip (+y) sits at the lamp
          const k = light.intensity / INTENSITY_MAX;
          (l.beam.material as import("three").MeshBasicMaterial).opacity = 0.03 + 0.17 * k;
          (l.beam.material as import("three").MeshBasicMaterial).color.set(light.color);
          (l.lens.material as import("three").MeshBasicMaterial).color.set(light.color);
          l.spot.color.set(light.color); l.spot.intensity = k * 55;
        }
        function sync() {
          while (lamps.length < goal.length) lamps.push(makeLamp());
          while (lamps.length > goal.length) removeLamp(lamps.pop()!);
        }
        // glide every lamp towards where it should be; keep drawing until they arrive
        let raf = 0;
        function frame() {
          raf = 0;
          let moving = false;
          lamps.forEach((l, i) => {
            const g = goal[i]; if (!g) return;
            const dr = shortest(l.rotate, g.rotate), de = g.elevation - l.elevation;
            if (Math.abs(dr) > 0.15 || Math.abs(de) > 0.15) { l.rotate = (l.rotate + dr * SMOOTH + 360) % 360; l.elevation += de * SMOOTH; moving = true; }
            else { l.rotate = g.rotate; l.elevation = g.elevation; }
            pose(l, g, i === sel0);
          });
          renderer.render(scene, camera);
          if (moving) raf = requestAnimationFrame(frame);
        }
        function kick() { if (!raf) raf = requestAnimationFrame(frame); }

        const update = (ls: Light[], s: number) => {
          const added = ls.length > lamps.length;
          goal = ls; sel0 = s;
          sync();
          if (added) lamps.forEach((l, i) => { if (i >= lamps.length - (ls.length - lamps.length || 1) && !l.group.userData.placed) { l.rotate = ls[i].rotate; l.elevation = ls[i].elevation; l.group.userData.placed = true; } });
          lamps.forEach((l) => { l.group.userData.placed = true; });
          kick();
        };

        const size = () => {
          const w = el.clientWidth || 300, h = el.clientHeight || 240;
          renderer.setSize(w, h, false); camera.aspect = w / h;
          const wide = camera.aspect > 1.8;
          camera.position.set(1.4, wide ? 2.4 : 2.9, wide ? 7.0 : 7.6); camera.lookAt(0, 1.0, 0);
          camera.updateProjectionMatrix(); kick();
        };
        const ro = new ResizeObserver(size); ro.observe(el); size();

        // dragging a lamp round the picture
        const ray = new T.Raycaster();
        const ndc = new T.Vector2();
        const dom = renderer.domElement;
        let drag = -1;
        const setRay = (e: PointerEvent) => { const r = dom.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, camera); };
        const onDown = (e: PointerEvent) => {
          setRay(e);
          const hit = ray.intersectObjects(lamps.map((l) => l.hit), false)[0];
          if (!hit) return;
          e.preventDefault(); dom.setPointerCapture?.(e.pointerId);
          drag = lamps.findIndex((l) => l.hit === hit.object);
          latest.current.onSelect(drag);
        };
        const onMovePtr = (e: PointerEvent) => {
          if (drag < 0) return;
          setRay(e);
          const sphere = new T.Sphere(new T.Vector3(0, CY, 0), R);
          const p = new T.Vector3();
          if (!ray.ray.intersectSphere(sphere, p)) return;
          const d = p.clone().sub(sphere.center);
          const el2 = (Math.asin(Math.max(-1, Math.min(1, d.y / R))) * 180) / Math.PI;
          const az = (Math.atan2(-d.x, d.z) * 180) / Math.PI;
          latest.current.onMove(drag, { rotate: ((Math.round(az) % 360) + 360) % 360, elevation: Math.round(Math.max(ELEV_MIN, Math.min(ELEV_MAX, el2))) });
        };
        const onUp = () => { drag = -1; };
        dom.addEventListener("pointerdown", onDown); dom.addEventListener("pointermove", onMovePtr); dom.addEventListener("pointerup", onUp); dom.addEventListener("pointercancel", onUp);

        api.current = { update };
        // the first lamps start where they belong
        goal = latest.current.lights; sel0 = latest.current.sel; sync();
        lamps.forEach((l, i) => { l.rotate = goal[i].rotate; l.elevation = goal[i].elevation; });
        kick();
        cleanup = () => {
          ro.disconnect(); cancelAnimationFrame(raf);
          dom.removeEventListener("pointerdown", onDown); dom.removeEventListener("pointermove", onMovePtr); dom.removeEventListener("pointerup", onUp); dom.removeEventListener("pointercancel", onUp);
          lamps.forEach(removeLamp);
          scene.traverse((o) => { const m = o as import("three").Mesh; m.geometry?.dispose?.(); const mt = m.material as import("three").Material | undefined; mt?.dispose?.(); });
          renderer.dispose(); dom.remove(); api.current = null;
        };
      } catch {
        if (!disposed) onFail();
      }
    })();
    return () => { disposed = true; cleanup(); };
  }, [thumb]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { api.current?.update(lights, sel); }, [lights, sel]);

  return <div ref={host} className="cr-cam-3d" />;
}
