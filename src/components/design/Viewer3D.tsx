"use client";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { Camera, Download, Grid3x3, Info, Lightbulb, Palette, Square } from "lucide-react";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { OBJExporter } from "three/examples/jsm/exporters/OBJExporter.js";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter.js";
import { USDZExporter } from "three/examples/jsm/exporters/USDZExporter.js";

type Bg = "dark" | "light" | "studio";
const BG: Record<Bg, string> = { dark: "radial-gradient(80% 80% at 50% 30%, #2a2a31, #0d0d10)", light: "radial-gradient(80% 80% at 50% 30%, #ffffff, #dcdce2)", studio: "radial-gradient(80% 80% at 50% 30%, #6b3a3a, #1a0c0c)" };
const FORMATS = [["glb", "GLB", "Textures and colours kept"], ["obj", "OBJ", "Shape only, no colours"], ["stl", "STL", "Shape only, for 3D printing"], ["usdz", "USDZ", "For Apple AR"]] as const;
const save = (blob: Blob, name: string) => { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); };

// A turntable viewer for one .glb: drag to turn, wheel or pinch to zoom, the model is centred and fitted. Tools under it: wireframe, grid, background, light,
// a still picture of the current angle, the model's size, and downloads in other formats (made in the browser from the loaded model).
export default function Viewer3D({ url, label }: { url: string; label: string }) {
  const host = useRef<HTMLDivElement>(null);
  const api = useRef<{ obj?: THREE.Object3D; grid?: THREE.GridHelper; hemi?: THREE.HemisphereLight; key?: THREE.DirectionalLight; shot?: () => string }>({});
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [wire, setWire] = useState(false), [grid, setGrid] = useState(true), [bg, setBg] = useState<Bg>("dark"), [bright, setBright] = useState(false);
  const [info, setInfo] = useState<{ faces: number; parts: number; w: number; h: number; d: number } | null>(null);
  const [panel, setPanel] = useState<null | "info" | "download">(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const el = host.current; if (!el) return;
    setState("loading"); setInfo(null);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    el.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, 1, 0.01, 1000);
    const hemi = new THREE.HemisphereLight(0xffffff, 0x444455, 1.6), key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(3, 5, 4); scene.add(hemi, key);
    Object.assign(api.current, { hemi, key, shot: () => { renderer.render(scene, camera); return renderer.domElement.toDataURL("image/png"); } });
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
      const g = new THREE.GridHelper(r * 4, 20, 0x5a5a66, 0x33333b); g.position.y = -s.y / 2; scene.add(g);
      api.current.obj = obj; api.current.grid = g;
      let faces = 0, parts = 0;
      obj.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { parts++; const geo = m.geometry; faces += Math.round((geo.index ? geo.index.count : geo.attributes.position.count) / 3); } });
      setInfo({ faces, parts, w: s.x, h: s.y, d: s.z });
      camera.position.set(d * 0.8, d * 0.5, d); camera.near = r / 100; camera.far = r * 100; camera.updateProjectionMatrix(); controls.update();
      setState("ready");
    }, undefined, () => { if (!dead) setState("error"); });
    const loop = () => { raf = requestAnimationFrame(loop); controls.update(); renderer.render(scene, camera); };
    loop();
    return () => {
      dead = true; cancelAnimationFrame(raf); ro.disconnect(); controls.dispose(); api.current = {};
      scene.traverse((o) => { const m = o as THREE.Mesh; if (m.geometry) m.geometry.dispose(); const mat = m.material as THREE.Material | THREE.Material[] | undefined; (Array.isArray(mat) ? mat : mat ? [mat] : []).forEach((x) => x.dispose()); });
      renderer.dispose(); renderer.domElement.remove();
    };
  }, [url]);

  useEffect(() => { api.current.obj?.traverse((o) => { const m = o as THREE.Mesh; if (!m.isMesh) return; (Array.isArray(m.material) ? m.material : [m.material]).forEach((x) => { (x as THREE.MeshStandardMaterial).wireframe = wire; }); }); }, [wire, state]);
  useEffect(() => { if (api.current.grid) api.current.grid.visible = grid; }, [grid, state]);
  useEffect(() => { if (api.current.hemi && api.current.key) { api.current.hemi.intensity = bright ? 2.6 : 1.6; api.current.key.intensity = bright ? 3.4 : 2.2; } }, [bright, state]);

  async function download(f: (typeof FORMATS)[number][0]) {
    const obj = api.current.obj; if (!obj) return;
    setBusy(true);
    try {
      const base = label.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-") || "model";
      if (f === "obj") save(new Blob([new OBJExporter().parse(obj)], { type: "text/plain" }), `${base}.obj`);
      else if (f === "stl") save(new Blob([new STLExporter().parse(obj, { binary: true }) as unknown as BlobPart], { type: "model/stl" }), `${base}.stl`);
      else if (f === "usdz") save(new Blob([(await new USDZExporter().parseAsync(obj)) as unknown as BlobPart], { type: "model/vnd.usdz+zip" }), `${base}.usdz`);
      else { const buf = await new GLTFExporter().parseAsync(obj, { binary: true }); save(new Blob([buf as ArrayBuffer], { type: "model/gltf-binary" }), `${base}.glb`); }
    } catch { /* a format the model cannot be turned into simply does not download */ }
    setBusy(false); setPanel(null);
  }
  const still = () => { const u = api.current.shot?.(); if (!u) return; const a = document.createElement("a"); a.href = u; a.download = `${label.replace(/\s+/g, "-") || "model"}.png`; a.click(); };
  const cm = (n: number) => `${(n * 100).toFixed(n * 100 < 10 ? 1 : 0)}`;

  return (
    <div className="ds-viewwrap">
      <div className="ds-viewer" ref={host} style={{ background: BG[bg] }} role="img" aria-label={`3D model: ${label}. Drag to turn it.`}>
        {state !== "ready" && <div className="ds-viewer-note">{state === "error" ? "The model could not be shown." : "Loading model…"}</div>}
      </div>
      {state === "ready" && (
        <div className="ds-vtools" role="toolbar" aria-label="Viewer tools">
          <button type="button" className={wire ? "is-on" : ""} aria-pressed={wire} onClick={() => setWire(!wire)} title="Show only the edges the model is built from"><Square size={14} />Wireframe</button>
          <button type="button" className={grid ? "is-on" : ""} aria-pressed={grid} onClick={() => setGrid(!grid)} title="Floor grid"><Grid3x3 size={14} />Grid</button>
          <button type="button" onClick={() => setBg(bg === "dark" ? "light" : bg === "light" ? "studio" : "dark")} title="Change the background"><Palette size={14} />Background</button>
          <button type="button" className={bright ? "is-on" : ""} aria-pressed={bright} onClick={() => setBright(!bright)} title="Brighter light"><Lightbulb size={14} />Light</button>
          <button type="button" onClick={still} title="Save a picture of this angle"><Camera size={14} />Picture</button>
          <button type="button" className={panel === "info" ? "is-on" : ""} aria-expanded={panel === "info"} onClick={() => setPanel(panel === "info" ? null : "info")} title="Size and detail"><Info size={14} />Info</button>
          <button type="button" className={panel === "download" ? "is-on" : ""} aria-expanded={panel === "download"} onClick={() => setPanel(panel === "download" ? null : "download")} title="Download in another format"><Download size={14} />Formats</button>
        </div>
      )}
      {panel === "info" && info && (
        <dl className="ds-info" aria-label="Model info"><div><dt>Faces</dt><dd>{info.faces.toLocaleString()}</dd></div><div><dt>Parts</dt><dd>{info.parts}</dd></div><div><dt>Size</dt><dd>{cm(info.w)} × {cm(info.h)} × {cm(info.d)}</dd></div></dl>
      )}
      {panel === "download" && (
        <div className="ds-formats" role="menu" aria-label="Download format">
          {FORMATS.map(([id, name, note]) => <button key={id} type="button" role="menuitem" disabled={busy} onClick={() => void download(id)}><b>{name}</b><span>{note}</span></button>)}
        </div>
      )}
    </div>
  );
}
