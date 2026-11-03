"use client";

import { useEffect, useRef } from "react";
import { VERTICAL_MAX, VERTICAL_MIN, wrap360, type Cam, type ZoomId } from "@/lib/camera/prompt";

type Props = {
  thumb: string; cams: Cam[]; sel: number;
  onSelect: (i: number) => void;
  onMove: (index: number, patch: { rotate?: number; vertical?: number }) => void;
  onFail: () => void;
};

const R = 2.4; // how far a camera stands from the picture at the original framing
const CY = 0.85; // height of the picture's centre
const rad = (d: number) => (d * Math.PI) / 180;
// zoom moves the camera nearer to or farther from the picture
const ZOOM_DIST: Record<ZoomId, number> = { initial: 1, medium: 0.82, medium_close: 0.66, closer: 0.5, far: 1.3 };
const place = (rotate: number, vertical: number, dist: number) => [-dist * Math.sin(rad(rotate)) * Math.cos(rad(vertical)), CY + dist * Math.sin(rad(vertical)), dist * Math.cos(rad(rotate)) * Math.cos(rad(vertical))] as const;
const SMOOTH = 0.16;

/** The Change Camera preview: the picture stands on a floor and real camera equipment stands round it, aimed at it, each with the view it will frame.
 * A camera glides smoothly to its new place when you tap a chip, move a slider or drag it round the picture. */
export default function ThreeCamera({ thumb, cams, sel, onSelect, onMove, onFail }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const api = useRef<{ update: (cs: Cam[], s: number) => void } | null>(null);
  const latest = useRef({ cams, sel, onSelect, onMove });
  latest.current = { cams, sel, onSelect, onMove };

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
        // the scene takes the app theme (the stage colour is read from the page)
        const stage = getComputedStyle(el).getPropertyValue("--a-input").trim() || "#0d0d10";
        let bg = new T.Color(0x0d0d10);
        try { bg = new T.Color(stage); } catch { /* keep the dark default */ }
        const dark = bg.r * 0.299 + bg.g * 0.587 + bg.b * 0.114 < 0.5;
        renderer.setClearColor(bg, 1);
        el.appendChild(renderer.domElement);
        renderer.domElement.style.cssText = "position:absolute;inset:0;display:block;width:100%;height:100%;touch-action:none;"; // out of the layout, so the canvas never decides the height of its box

        const scene = new T.Scene();
        const camera = new T.PerspectiveCamera(38, 1, 0.1, 60);
        scene.add(new T.AmbientLight(0xffffff, 1.0));
        const sun = new T.DirectionalLight(0xffffff, 2.2); sun.position.set(2.5, 5, 4); scene.add(sun);

        const grid = new T.GridHelper(12, 24, dark ? 0x4a5080 : 0x9a9aa8, dark ? 0x2a2e4a : 0xc4c4cf);
        (grid.material as import("three").Material).transparent = true;
        (grid.material as import("three").Material).opacity = 0.65;
        scene.add(grid);
        const shadow = new T.Mesh(new T.CircleGeometry(0.8, 32), new T.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: dark ? 0.5 : 0.18 }));
        shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.01; scene.add(shadow);

        const card = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ color: 0x333333, side: T.DoubleSide }));
        scene.add(card);
        const setCard = (w: number, h: number) => { const k = 1.7 / Math.max(w, h); card.scale.set(w * k, h * k, 1); card.position.set(0, (h * k) / 2, 0); };
        setCard(1, 1);
        new T.TextureLoader().load(thumb, (tex) => {
          tex.colorSpace = T.SRGBColorSpace;
          const m = card.material as import("three").MeshBasicMaterial; m.map = tex; m.color.set(0xffffff); m.needsUpdate = true;
          const im = tex.image as { width: number; height: number };
          setCard(im.width || 1, im.height || 1);
          kick();
        });

        // a camera: a body, a lens, a viewfinder, a small red light, and the view it frames drawn as a pyramid
        type Rig = { rotate: number; vertical: number; dist: number; group: import("three").Group; accent: import("three").Mesh; view: import("three").Mesh; hit: import("three").Mesh };
        const rigs: Rig[] = [];
        const bodyGeo = new T.BoxGeometry(0.46, 0.32, 0.26);
        const lensGeo = new T.CylinderGeometry(0.13, 0.15, 0.24, 24);
        const rimGeo = new T.CylinderGeometry(0.155, 0.155, 0.04, 24);
        const finderGeo = new T.BoxGeometry(0.18, 0.09, 0.14);
        const viewGeo = new T.ConeGeometry(1, 1, 4, 1, true);
        const makeRig = (): Rig => {
          const group = new T.Group();
          const dark1 = new T.MeshStandardMaterial({ color: 0x2b2b30, roughness: 0.45, metalness: 0.5 });
          const body = new T.Mesh(bodyGeo, dark1);
          const lens = new T.Mesh(lensGeo, new T.MeshStandardMaterial({ color: 0x18181c, roughness: 0.35, metalness: 0.6 }));
          lens.rotation.x = Math.PI / 2; lens.position.z = 0.25;
          const rim = new T.Mesh(rimGeo, new T.MeshStandardMaterial({ color: 0xc9c9d2, roughness: 0.3, metalness: 0.8 }));
          rim.rotation.x = Math.PI / 2; rim.position.z = 0.37;
          const glass = new T.Mesh(new T.CircleGeometry(0.11, 24), new T.MeshBasicMaterial({ color: 0x3c4cff }));
          glass.position.z = 0.375;
          const finder = new T.Mesh(finderGeo, dark1); finder.position.set(0, 0.2, -0.02);
          const accent = new T.Mesh(new T.SphereGeometry(0.03, 12, 8), new T.MeshBasicMaterial({ color: 0xd90b0b }));
          accent.position.set(0.17, 0.1, 0.14);
          const hit = new T.Mesh(new T.SphereGeometry(0.42, 12, 8), new T.MeshBasicMaterial({ visible: false }));
          group.add(body, lens, rim, glass, finder, accent, hit);
          const view = new T.Mesh(viewGeo, new T.MeshBasicMaterial({ color: 0x4f6bff, transparent: true, opacity: 0.12, depthWrite: false, side: T.DoubleSide }));
          scene.add(group, view);
          return { rotate: 0, vertical: 0, dist: R, group, accent, view, hit };
        };
        const removeRig = (r: Rig) => {
          scene.remove(r.group, r.view);
          r.group.traverse((o) => { const m = o as import("three").Mesh; (m.material as import("three").Material | undefined)?.dispose?.(); });
          (r.view.material as import("three").Material).dispose();
        };

        let goal: Cam[] = [];
        let sel0 = 0;
        const shortest = (from: number, to: number) => ((to - from + 540) % 360) - 180;
        function pose(r: Rig, i: number) {
          const [x, y, z] = place(r.rotate, r.vertical, r.dist);
          r.group.position.set(x, y, z);
          r.group.lookAt(0, CY, 0);
          const selected = i === sel0;
          r.group.scale.setScalar(selected ? 0.95 : 0.75);
          (r.accent.material as import("three").MeshBasicMaterial).color.set(selected ? 0xd90b0b : 0x6a6a74);
          // the framed view: a pyramid from the camera to the picture's plane (tip at the camera)
          const len = Math.hypot(x, y - CY, z);
          r.view.scale.set(0.95, len, 0.95 * 1.25);
          r.view.position.set(x / 2, CY + (y - CY) / 2, z / 2);
          r.view.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), new T.Vector3(x, y - CY, z).normalize());
          r.view.rotateY(Math.PI / 4);
          (r.view.material as import("three").MeshBasicMaterial).color.set(selected ? 0xd90b0b : 0x4f6bff);
          (r.view.material as import("three").MeshBasicMaterial).opacity = selected ? 0.16 : 0.09;
        }
        function sync() {
          while (rigs.length < goal.length) rigs.push(makeRig());
          while (rigs.length > goal.length) removeRig(rigs.pop()!);
        }
        let raf = 0;
        function frame() {
          raf = 0;
          let moving = false;
          rigs.forEach((r, i) => {
            const g = goal[i]; if (!g) return;
            const dr = shortest(r.rotate, g.rotate), dv = g.vertical - r.vertical, dd = R * ZOOM_DIST[g.zoom] - r.dist;
            if (Math.abs(dr) > 0.15 || Math.abs(dv) > 0.15 || Math.abs(dd) > 0.004) {
              r.rotate = (r.rotate + dr * SMOOTH + 360) % 360; r.vertical += dv * SMOOTH; r.dist += dd * SMOOTH; moving = true;
            } else { r.rotate = g.rotate; r.vertical = g.vertical; r.dist = R * ZOOM_DIST[g.zoom]; }
            pose(r, i);
          });
          renderer.render(scene, camera);
          if (moving) raf = requestAnimationFrame(frame);
        }
        function kick() { if (!raf) raf = requestAnimationFrame(frame); }

        const update = (cs: Cam[], s: number) => {
          const before = rigs.length;
          goal = cs; sel0 = s;
          sync();
          for (let i = before; i < rigs.length; i++) { rigs[i].rotate = cs[i].rotate; rigs[i].vertical = cs[i].vertical; rigs[i].dist = R * ZOOM_DIST[cs[i].zoom]; }
          kick();
        };

        const size = () => {
          const w = el.clientWidth || 300, h = el.clientHeight || 240;
          renderer.setSize(w, h, false); camera.aspect = w / h;
          const wide = camera.aspect > 1.8;
          camera.position.set(wide ? 1.4 : 1.4, wide ? 2.4 : 2.7, wide ? 6.8 : 8.4); camera.lookAt(0, 0.85, 0);
          camera.updateProjectionMatrix(); kick();
        };
        const ro = new ResizeObserver(size); ro.observe(el); size();

        // dragging a camera round the picture (both the turn and the height at once)
        const ray = new T.Raycaster();
        const ndc = new T.Vector2();
        const dom = renderer.domElement;
        let drag = -1;
        const setRay = (e: PointerEvent) => { const r = dom.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, camera); };
        const onDown = (e: PointerEvent) => {
          setRay(e);
          const hit = ray.intersectObjects(rigs.map((r) => r.hit), false)[0];
          if (!hit) return;
          e.preventDefault(); dom.setPointerCapture?.(e.pointerId);
          drag = rigs.findIndex((r) => r.hit === hit.object); latest.current.onSelect(drag);
        };
        const onMovePtr = (e: PointerEvent) => {
          if (drag < 0) return;
          setRay(e);
          const d0 = rigs[drag]?.dist ?? R;
          const sphere = new T.Sphere(new T.Vector3(0, CY, 0), d0);
          const p = new T.Vector3();
          if (!ray.ray.intersectSphere(sphere, p)) return;
          const d = p.clone().sub(sphere.center);
          const v = (Math.asin(Math.max(-1, Math.min(1, d.y / d0))) * 180) / Math.PI;
          const az = (Math.atan2(-d.x, d.z) * 180) / Math.PI;
          latest.current.onMove(drag, { rotate: wrap360(az), vertical: Math.round(Math.max(VERTICAL_MIN, Math.min(VERTICAL_MAX, v))) });
        };
        const onUp = () => { drag = -1; };
        dom.addEventListener("pointerdown", onDown); dom.addEventListener("pointermove", onMovePtr); dom.addEventListener("pointerup", onUp); dom.addEventListener("pointercancel", onUp);

        api.current = { update };
        goal = latest.current.cams; sel0 = latest.current.sel; sync();
        rigs.forEach((r, i) => { r.rotate = goal[i].rotate; r.vertical = goal[i].vertical; r.dist = R * ZOOM_DIST[goal[i].zoom]; });
        kick();
        cleanup = () => {
          ro.disconnect(); cancelAnimationFrame(raf);
          dom.removeEventListener("pointerdown", onDown); dom.removeEventListener("pointermove", onMovePtr); dom.removeEventListener("pointerup", onUp); dom.removeEventListener("pointercancel", onUp);
          rigs.forEach(removeRig);
          scene.traverse((o) => { const m = o as import("three").Mesh; m.geometry?.dispose?.(); const mt = m.material as import("three").Material | undefined; mt?.dispose?.(); });
          renderer.dispose(); dom.remove(); api.current = null;
        };
      } catch {
        if (!disposed) onFail();
      }
    })();
    return () => { disposed = true; cleanup(); };
  }, [thumb]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { api.current?.update(cams, sel); }, [cams, sel]);

  return <div ref={host} className="cr-cam-3d" />;
}
