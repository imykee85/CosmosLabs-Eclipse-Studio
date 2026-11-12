"use client";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

// A plain turntable viewer for one .glb: drag to turn, wheel or pinch to zoom, the model is centred and fitted. The file is fetched from Eclipse's own address.
export default function Viewer3D({ url, label }: { url: string; label: string }) {
  const host = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  useEffect(() => {
    const el = host.current; if (!el) return;
    setState("loading");
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    el.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, 1, 0.01, 1000);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x444455, 1.6));
    const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(3, 5, 4); scene.add(key);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; controls.autoRotate = true; controls.autoRotateSpeed = 1.2;
    controls.addEventListener("start", () => { controls.autoRotate = false; });
    let raf = 0, dead = false;
    const size = () => { const w = el.clientWidth || 300, h = el.clientHeight || 300; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); };
    size(); const ro = new ResizeObserver(size); ro.observe(el);
    new GLTFLoader().load(url, (gltf) => {
      if (dead) return;
      const obj = gltf.scene, box = new THREE.Box3().setFromObject(obj), c = box.getCenter(new THREE.Vector3()), s = box.getSize(new THREE.Vector3());
      obj.position.sub(c); scene.add(obj);
      const r = Math.max(s.x, s.y, s.z) || 1, d = r * 1.9;
      camera.position.set(d * 0.8, d * 0.5, d); camera.near = r / 100; camera.far = r * 100; camera.updateProjectionMatrix(); controls.update();
      setState("ready");
    }, undefined, () => { if (!dead) setState("error"); });
    const loop = () => { raf = requestAnimationFrame(loop); controls.update(); renderer.render(scene, camera); };
    loop();
    return () => {
      dead = true; cancelAnimationFrame(raf); ro.disconnect(); controls.dispose();
      scene.traverse((o) => { const m = o as THREE.Mesh; if (m.geometry) m.geometry.dispose(); const mat = m.material as THREE.Material | THREE.Material[] | undefined; (Array.isArray(mat) ? mat : mat ? [mat] : []).forEach((x) => x.dispose()); });
      renderer.dispose(); renderer.domElement.remove();
    };
  }, [url]);
  return (
    <div className="ds-viewer" ref={host} role="img" aria-label={`3D model: ${label}. Drag to turn it.`}>
      {state !== "ready" && <div className="ds-viewer-note">{state === "error" ? "The model could not be shown." : "Loading model…"}</div>}
    </div>
  );
}
