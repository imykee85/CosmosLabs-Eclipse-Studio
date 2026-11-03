"use client";

import { useEffect, useRef } from "react";
import { VERTICAL_MAX, VERTICAL_MIN, wrap360, type Cam } from "@/lib/camera/prompt";

type Props = {
  thumb: string; cams: Cam[]; sel: number;
  onSelect: (i: number) => void;
  onMove: (index: number, patch: { rotate?: number; vertical?: number }) => void;
  onFail: () => void;
};

const R = 1.55; // ring radius
const CY = 0.78; // height of the picture's centre
const rad = (d: number) => (d * Math.PI) / 180;

/** The real 3D scene of Change Camera: a picture standing on a grid floor, a ring round it for rotation and an arc for height.
 * Blue balls sit on the ring (drag to rotate); the purple ball sits on the arc of the chosen camera (drag to raise or lower it). */
export default function ThreeCamera({ thumb, cams, sel, onSelect, onMove, onFail }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const api = useRef<{ update: (cams: Cam[], sel: number) => void } | null>(null);
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
        const renderer = new T.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "low-power" });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.setClearColor(0x0d0d10, 1);
        el.appendChild(renderer.domElement);
        renderer.domElement.style.cssText = "position:absolute;inset:0;display:block;width:100%;height:100%;touch-action:none;"; // out of the layout, so the canvas size never decides the height of its box (Safari did that)

        const scene = new T.Scene();
        const camera = new T.PerspectiveCamera(38, 1.25, 0.1, 50);
        camera.position.set(0.3, 2.9, 6.7);
        camera.lookAt(0, 0.6, 0);

        scene.add(new T.AmbientLight(0xffffff, 1.2));
        const sun = new T.DirectionalLight(0xffffff, 2.2);
        sun.position.set(2.5, 5, 4);
        scene.add(sun);

        const grid = new T.GridHelper(9, 18, 0x3d4580, 0x242842);
        (grid.material as import("three").Material).transparent = true;
        (grid.material as import("three").Material).opacity = 0.7;
        scene.add(grid);

        // the picture, standing on the floor
        const card = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ color: 0x222222, side: T.DoubleSide }));
        card.position.set(0, CY, 0);
        scene.add(card);
        const setCard = (w: number, h: number) => { const k = 1.5 / Math.max(w, h); card.scale.set(w * k, h * k, 1); card.position.y = (h * k) / 2; };
        setCard(1, 1);
        new T.TextureLoader().load(thumb, (tex) => {
          tex.colorSpace = T.SRGBColorSpace;
          (card.material as import("three").MeshBasicMaterial).map = tex;
          (card.material as import("three").MeshBasicMaterial).color.set(0xffffff);
          (card.material as import("three").MeshBasicMaterial).needsUpdate = true;
          const im = tex.image as { width: number; height: number };
          setCard(im.width || 1, im.height || 1);
          render();
        });
        const shadow = new T.Mesh(new T.CircleGeometry(0.75, 32), new T.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3 }));
        shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.01; scene.add(shadow);

        // the ring on the floor
        const ring = new T.Mesh(new T.TorusGeometry(R, 0.035, 12, 96), new T.MeshStandardMaterial({ color: 0x4f6bff, emissive: 0x2a3cff, emissiveIntensity: 0.9 }));
        ring.rotation.x = Math.PI / 2; ring.position.y = 0.04; scene.add(ring);

        // the arc of the chosen camera (a slice of a circle standing upright, turned to that camera's direction)
        const a0 = rad(VERTICAL_MIN), a1 = rad(VERTICAL_MAX);
        const arcGeo = new T.TorusGeometry(R, 0.035, 12, 64, a1 - a0);
        const arc = new T.Mesh(arcGeo, new T.MeshStandardMaterial({ color: 0x8a5cf5, emissive: 0x6a38e8, emissiveIntensity: 0.9 }));
        const arcPivot = new T.Group(); arcPivot.position.set(0, CY, 0); arcPivot.add(arc);
        arc.rotation.z = a0; // torus starts at +x going counter-clockwise in the xy plane
        scene.add(arcPivot);

        const camBalls: import("three").Mesh[] = [];
        const ballGeo = new T.SphereGeometry(0.15, 24, 18);
        const purple = new T.Mesh(new T.SphereGeometry(0.17, 24, 18), new T.MeshStandardMaterial({ color: 0x9a6bff, emissive: 0x5b2fd0, emissiveIntensity: 0.6, roughness: 0.25, metalness: 0.1 }));
        scene.add(purple);

        const update = (cs: Cam[], s: number) => {
          while (camBalls.length < cs.length) {
            const m = new T.Mesh(ballGeo, new T.MeshStandardMaterial({ color: 0x4f6bff, emissive: 0x1d2fd6, emissiveIntensity: 0.5, roughness: 0.25, metalness: 0.1 }));
            scene.add(m); camBalls.push(m);
          }
          while (camBalls.length > cs.length) { const m = camBalls.pop()!; scene.remove(m); (m.material as import("three").Material).dispose(); }
          cs.forEach((c, i) => {
            const a = rad(c.rotate);
            camBalls[i].position.set(-R * Math.sin(a), 0.1, R * Math.cos(a));
            const mat = camBalls[i].material as import("three").MeshStandardMaterial;
            mat.color.set(i === s ? 0xd90b0b : 0x4f6bff); mat.emissive.set(i === s ? 0x8a0000 : 0x1d2fd6);
            camBalls[i].scale.setScalar(i === s ? 1.25 : 1);
          });
          const c = cs[s] ?? cs[0];
          if (c) {
            const a = rad(c.rotate), v = rad(c.vertical);
            arcPivot.rotation.y = Math.atan2(-Math.cos(a), -Math.sin(a)); // local +x (the arc's start) turns to point at the camera: (-sin a, 0, cos a)
            purple.position.set(-R * Math.sin(a) * Math.cos(v), CY + R * Math.sin(v), R * Math.cos(a) * Math.cos(v));
          }
          render();
        };

        let raf = 0;
        function render() { if (raf) return; raf = requestAnimationFrame(() => { raf = 0; renderer.render(scene, camera); }); }
        const size = () => { const w = el.clientWidth || 300, h = el.clientHeight || 240; renderer.setSize(w, h, false); camera.aspect = w / h;
          const wide = camera.aspect > 1.8; // a wide, short stage: come in a little closer so the scene fills it
          camera.position.set(0.3, wide ? 2.5 : 2.9, wide ? 5.9 : 6.7); camera.lookAt(0, 0.6, 0);
          camera.updateProjectionMatrix(); render(); };
        const ro = new ResizeObserver(size); ro.observe(el); size();

        // dragging
        const ray = new T.Raycaster();
        const ndc = new T.Vector2();
        let drag: { kind: "ring" | "arc"; index: number } | null = null;
        const setRay = (e: PointerEvent) => { const r = renderer.domElement.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, camera); };
        const dom = renderer.domElement;
        const onDown = (e: PointerEvent) => {
          setRay(e);
          const hit = ray.intersectObjects([...camBalls, purple], false)[0];
          if (!hit) return;
          e.preventDefault();
          dom.setPointerCapture?.(e.pointerId);
          if (hit.object === purple) drag = { kind: "arc", index: latest.current.sel };
          else { const i = camBalls.indexOf(hit.object as import("three").Mesh); drag = { kind: "ring", index: i }; latest.current.onSelect(i); }
        };
        const onMovePtr = (e: PointerEvent) => {
          if (!drag) return;
          setRay(e);
          if (drag.kind === "ring") {
            const p = new T.Vector3();
            if (ray.ray.intersectPlane(new T.Plane(new T.Vector3(0, 1, 0), -0.1), p)) latest.current.onMove(drag.index, { rotate: wrap360((Math.atan2(-p.x, p.z) * 180) / Math.PI) });
          } else {
            const c = latest.current.cams[drag.index]; if (!c) return;
            const a = rad(c.rotate);
            const dir = new T.Vector3(-Math.sin(a), 0, Math.cos(a));
            const normal = new T.Vector3(Math.cos(a), 0, Math.sin(a));
            const p = new T.Vector3();
            if (ray.ray.intersectPlane(new T.Plane(normal, -normal.dot(new T.Vector3(0, CY, 0))), p)) {
              const along = Math.max(0.05, p.clone().sub(new T.Vector3(0, CY, 0)).dot(dir));
              const el2 = (Math.atan2(p.y - CY, along) * 180) / Math.PI;
              latest.current.onMove(drag.index, { vertical: Math.round(Math.max(VERTICAL_MIN, Math.min(VERTICAL_MAX, el2))) });
            }
          }
        };
        const onUp = () => { drag = null; };
        dom.addEventListener("pointerdown", onDown); dom.addEventListener("pointermove", onMovePtr); dom.addEventListener("pointerup", onUp); dom.addEventListener("pointercancel", onUp);

        api.current = { update };
        update(latest.current.cams, latest.current.sel);
        cleanup = () => {
          ro.disconnect(); cancelAnimationFrame(raf);
          dom.removeEventListener("pointerdown", onDown); dom.removeEventListener("pointermove", onMovePtr); dom.removeEventListener("pointerup", onUp); dom.removeEventListener("pointercancel", onUp);
          scene.traverse((o) => { const m = o as import("three").Mesh; m.geometry?.dispose?.(); const mat = m.material as import("three").Material | undefined; mat?.dispose?.(); });
          renderer.dispose(); dom.remove(); api.current = null;
        };
      } catch {
        if (!disposed) onFail();
      }
    })();
    return () => { disposed = true; cleanup(); };
    // the scene is built once per picture; later changes go through update()
  }, [thumb]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { api.current?.update(cams, sel); }, [cams, sel]);

  return <div ref={host} className="cr-cam-3d" />;
}
