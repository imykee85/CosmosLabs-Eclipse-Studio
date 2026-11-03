"use client";

import { useEffect, useRef } from "react";
import { ELEV_MAX, ELEV_MIN, INTENSITY_MAX, type Light } from "@/lib/relight/prompt";

type Props = {
  thumb: string; lights: Light[]; sel: number;
  onSelect: (i: number) => void;
  onMove: (index: number, patch: { rotate: number; elevation: number }) => void;
  onFail: () => void;
};

const R = 1.9; // how far the lights stand from the picture
const CY = 0.8; // height of the picture's centre
const rad = (d: number) => (d * Math.PI) / 180;
const pos = (l: Light) => [-R * Math.sin(rad(l.rotate)) * Math.cos(rad(l.elevation)), CY + R * Math.sin(rad(l.elevation)), R * Math.cos(rad(l.rotate)) * Math.cos(rad(l.elevation))] as const;

/** The light preview: the picture stands on a floor and is really lit by the lights you place, so you see the direction, colour and strength
 * before making anything. Drag a light round the picture to move it. */
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
        scene.add(new T.AmbientLight(0xffffff, 0.35));

        const grid = new T.GridHelper(10, 20, dark ? 0x4a5080 : 0x9a9aa8, dark ? 0x2a2e4a : 0xc4c4cf);
        (grid.material as import("three").Material).transparent = true;
        (grid.material as import("three").Material).opacity = 0.6;
        scene.add(grid);

        // the picture: a standing card that reacts to the lights
        const mat = new T.MeshStandardMaterial({ color: 0x555555, roughness: 0.85, metalness: 0, side: T.DoubleSide });
        const card = new T.Mesh(new T.PlaneGeometry(1, 1), mat);
        scene.add(card);
        const setCard = (w: number, h: number) => { const k = 1.6 / Math.max(w, h); card.scale.set(w * k, h * k, 1); card.position.set(0, (h * k) / 2, 0); };
        setCard(1, 1);
        new T.TextureLoader().load(thumb, (tex) => {
          tex.colorSpace = T.SRGBColorSpace;
          mat.map = tex; mat.color.set(0xffffff); mat.needsUpdate = true;
          const im = tex.image as { width: number; height: number };
          setCard(im.width || 1, im.height || 1);
          render();
        });

        // the lights: a glowing ball you can drag, and a real light at the same place
        const balls: import("three").Mesh[] = [];
        const lamps: import("three").PointLight[] = [];
        const ballGeo = new T.SphereGeometry(0.14, 20, 16);
        const update = (ls: Light[], s: number) => {
          while (balls.length < ls.length) {
            const b = new T.Mesh(ballGeo, new T.MeshBasicMaterial({ color: 0xffffff }));
            const lamp = new T.PointLight(0xffffff, 10, 0, 1.6);
            scene.add(b); scene.add(lamp); balls.push(b); lamps.push(lamp);
          }
          while (balls.length > ls.length) { const b = balls.pop()!; scene.remove(b); (b.material as import("three").Material).dispose(); const l = lamps.pop()!; scene.remove(l); l.dispose(); }
          ls.forEach((l, i) => {
            const [x, y, z] = pos(l);
            balls[i].position.set(x, y, z); lamps[i].position.set(x, y, z);
            (balls[i].material as import("three").MeshBasicMaterial).color.set(l.color);
            balls[i].scale.setScalar(i === s ? 1.35 : 1);
            lamps[i].color.set(l.color); lamps[i].intensity = (l.intensity / INTENSITY_MAX) * 30;
          });
          render();
        };

        let raf = 0;
        function render() { if (raf) return; raf = requestAnimationFrame(() => { raf = 0; renderer.render(scene, camera); }); }
        const size = () => {
          const w = el.clientWidth || 300, h = el.clientHeight || 240;
          renderer.setSize(w, h, false); camera.aspect = w / h;
          const wide = camera.aspect > 1.8;
          camera.position.set(0.4, wide ? 2.2 : 3.0, wide ? 5.4 : 8.0); camera.lookAt(0, 0.9, 0);
          camera.updateProjectionMatrix(); render();
        };
        const ro = new ResizeObserver(size); ro.observe(el); size();

        // dragging a light round the picture
        const ray = new T.Raycaster();
        const ndc = new T.Vector2();
        const dom = renderer.domElement;
        let drag = -1;
        const setRay = (e: PointerEvent) => { const r = dom.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, camera); };
        const onDown = (e: PointerEvent) => {
          setRay(e);
          const hit = ray.intersectObjects(balls, false)[0];
          if (!hit) return;
          e.preventDefault(); dom.setPointerCapture?.(e.pointerId);
          drag = balls.indexOf(hit.object as import("three").Mesh);
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
        update(latest.current.lights, latest.current.sel);
        cleanup = () => {
          ro.disconnect(); cancelAnimationFrame(raf);
          dom.removeEventListener("pointerdown", onDown); dom.removeEventListener("pointermove", onMovePtr); dom.removeEventListener("pointerup", onUp); dom.removeEventListener("pointercancel", onUp);
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
