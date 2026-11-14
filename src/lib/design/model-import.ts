// Opens a 3D file in the browser and hands back a .glb, so everything else (the viewer, ShotMap, the saved list) only ever deals with one format.
import * as THREE from "three";

export const MODEL_EXTENSIONS = ["glb", "gltf", "obj", "stl", "fbx", "ply", "dae", "3mf"] as const;
export const MODEL_ACCEPT = MODEL_EXTENSIONS.map((e) => `.${e}`).join(",");

export const extOf = (name: string) => (name.split(".").pop() ?? "").toLowerCase();
export const baseName = (name: string) => name.replace(/\.[^.]+$/, "");

const plain = () => new THREE.MeshStandardMaterial({ color: 0xbfbfc4, roughness: 0.6, metalness: 0.05 });
const mesh = (g: THREE.BufferGeometry) => { if (!g.attributes.normal) g.computeVertexNormals(); return new THREE.Mesh(g, plain()); };

async function parse(file: File, ext: string): Promise<THREE.Object3D> {
  const buf = await file.arrayBuffer();
  if (ext === "gltf") {
    const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
    return (await new GLTFLoader().parseAsync(new TextDecoder().decode(buf), "")).scene;
  }
  if (ext === "obj") {
    const { OBJLoader } = await import("three/examples/jsm/loaders/OBJLoader.js");
    const o = new OBJLoader().parse(new TextDecoder().decode(buf));
    o.traverse((c) => { const m = c as THREE.Mesh; if (m.isMesh) { if (!m.geometry.attributes.normal) m.geometry.computeVertexNormals(); m.material = plain(); } });
    return o;
  }
  if (ext === "stl") { const { STLLoader } = await import("three/examples/jsm/loaders/STLLoader.js"); return mesh(new STLLoader().parse(buf)); }
  if (ext === "ply") { const { PLYLoader } = await import("three/examples/jsm/loaders/PLYLoader.js"); return mesh(new PLYLoader().parse(buf)); }
  if (ext === "fbx") { const { FBXLoader } = await import("three/examples/jsm/loaders/FBXLoader.js"); return new FBXLoader().parse(buf, ""); }
  if (ext === "dae") { const { ColladaLoader } = await import("three/examples/jsm/loaders/ColladaLoader.js"); const d = new ColladaLoader().parse(new TextDecoder().decode(buf), ""); if (!d) throw new Error("empty"); return d.scene; }
  if (ext === "3mf") { const { ThreeMFLoader } = await import("three/examples/jsm/loaders/3MFLoader.js"); return new ThreeMFLoader().parse(buf); }
  throw new Error("unsupported");
}

/** Returns the file as .glb bytes. A .glb passes through untouched. Throws a plain message when the file cannot be read. */
export async function toGlb(file: File): Promise<ArrayBuffer> {
  const ext = extOf(file.name);
  if (!(MODEL_EXTENSIONS as readonly string[]).includes(ext)) throw new Error(`.${ext || "that"} files are not supported. Use ${MODEL_EXTENSIONS.map((e) => "." + e).join(", ")}.`);
  if (ext === "glb") return file.arrayBuffer();
  try {
    const obj = await parse(file, ext);
    const { GLTFExporter } = await import("three/examples/jsm/exporters/GLTFExporter.js");
    return (await new GLTFExporter().parseAsync(obj, { binary: true })) as ArrayBuffer;
  } catch {
    throw new Error(ext === "gltf" ? "That .gltf needs its other files (pictures or .bin). Save it as a single .glb and try again." : "That file could not be read as a 3D model.");
  }
}
