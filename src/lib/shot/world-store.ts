// ShotMap scenes kept in this browser, per project (a list plus one entry per scene), uploaded 3D models in IndexedDB, and the built-in templates.
import { addItem, editItem, emptyWorld, readWorld, setCameraKey, editShot, shotOf, type NewItem, type Vec3, type World } from "./world";

const INDEX = (p: string) => `eclipse-shot-scenes-${p || "none"}`;
const DOC = (id: string) => `eclipse-shot-scene-${id}`;
export type SceneEntry = { id: string; name: string; at: number };

export function listScenes(projectId: string | null): SceneEntry[] {
  try { const v = JSON.parse(localStorage.getItem(INDEX(projectId ?? "")) ?? "[]"); return Array.isArray(v) ? v.filter((e) => e && typeof e.id === "string").slice(0, 50) : []; } catch { return []; }
}
export function loadScene(id: string): World | null {
  try { return readWorld(JSON.parse(localStorage.getItem(DOC(id)) ?? "null")); } catch { return null; }
}
export function saveScene(projectId: string | null, id: string, w: World) {
  try {
    localStorage.setItem(DOC(id), JSON.stringify(w));
    const rest = listScenes(projectId).filter((e) => e.id !== id);
    localStorage.setItem(INDEX(projectId ?? ""), JSON.stringify([{ id, name: w.name, at: Date.now() }, ...rest].slice(0, 50)));
  } catch { /* storage full or blocked: the scene lives on in memory */ }
}
export function deleteScene(projectId: string | null, id: string) {
  try { localStorage.removeItem(DOC(id)); localStorage.setItem(INDEX(projectId ?? ""), JSON.stringify(listScenes(projectId).filter((e) => e.id !== id))); } catch { /* ignore */ }
}
export const newSceneId = () => `w${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-4)}`;

// ---- uploaded 3D models (.glb), kept only in this browser ----
const DB = "eclipse-shot-models", STORE = "models";
function openDb(): Promise<IDBDatabase> {
  return new Promise((res, rej) => { const r = indexedDB.open(DB, 1); r.onupgradeneeded = () => r.result.createObjectStore(STORE); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
}
export type ModelEntry = { key: string; name: string; at: number };
export async function putModel(name: string, data: ArrayBuffer): Promise<string> {
  const key = `m${Math.random().toString(36).slice(2, 10)}`, db = await openDb();
  await new Promise<void>((res, rej) => { const tx = db.transaction(STORE, "readwrite"); tx.objectStore(STORE).put({ name, data, at: Date.now() }, key); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); });
  return key;
}
export async function listModels(): Promise<{ list: ModelEntry[]; data: Map<string, ArrayBuffer> }> {
  try {
    const db = await openDb();
    return await new Promise((res) => {
      const list: ModelEntry[] = [], data = new Map<string, ArrayBuffer>(), tx = db.transaction(STORE, "readonly"), req = tx.objectStore(STORE).openCursor();
      req.onsuccess = () => { const c = req.result; if (!c) return; const v = c.value as { name: string; data: ArrayBuffer; at: number }; list.push({ key: String(c.key), name: v.name, at: v.at }); data.set(String(c.key), v.data); c.continue(); };
      tx.oncomplete = () => res({ list: list.sort((a, b) => b.at - a.at), data }); tx.onerror = () => res({ list: [], data });
    });
  } catch { return { list: [], data: new Map() }; }
}
export async function removeModel(key: string) { try { const db = await openDb(); db.transaction(STORE, "readwrite").objectStore(STORE).delete(key); } catch { /* ignore */ } }

// ---- recently added things (quick access in Add to scene) ----
const RECENT = "eclipse-shot-recent";
export function recentAdds(): NewItem[] { try { const v = JSON.parse(localStorage.getItem(RECENT) ?? "[]"); return Array.isArray(v) ? v.slice(0, 8) : []; } catch { return []; } }
export function rememberAdd(n: NewItem) {
  if (n.kind === "image" || n.kind === "model" || (n.kind === "person" && n.character)) return;
  try { const key = JSON.stringify(n); localStorage.setItem(RECENT, JSON.stringify([n, ...recentAdds().filter((x) => JSON.stringify(x) !== key)].slice(0, 8))); } catch { /* ignore */ }
}

// ---- templates ----
type Spec = [NewItem, Vec3, Partial<{ name: string; description: string; size: Vec3; rot: number; color: string; pose: import("./schema").Pose }>?];
function build(name: string, prompt: string, specs: Spec[], cam: { pos: Vec3; look: Vec3; lensMm?: number }[], seconds = 10, sky = "#1b1c22", ground = "#2a2c33"): World {
  let w: World = { ...emptyWorld(name, prompt), sky, ground };
  for (const [n, at, o = {}] of specs) {
    const made = addItem(w, n, at); w = made.world;
    w = editItem(w, made.id, { ...(o.name ? { name: o.name } : {}), ...(o.description ? { description: o.description } : {}), ...(o.color ? { color: o.color } : {}), ...(o.pose ? { pose: o.pose } : {}), ...(o.rot != null ? { rot: [0, o.rot, 0] } : {}), ...(o.size ? { scale: o.size } : {}) });
  }
  w = editShot(w, shotOf(w).id, { durationS: seconds });
  const camId = w.cameras[0].id; w = { ...w, cameras: w.cameras.map((c) => ({ ...c, keys: [] })) };
  cam.forEach((k, i) => { w = setCameraKey(w, camId, { t: cam.length > 1 ? (i / (cam.length - 1)) * seconds : 0, pos: k.pos, look: k.look, lensMm: k.lensMm ?? 35, fStop: 8, focusM: Math.hypot(k.pos[0] - k.look[0], k.pos[1] - k.look[1], k.pos[2] - k.look[2]), ease: "smooth" }).world; });
  return w;
}
export const TEMPLATES: { id: string; name: string; blurb: string; make: () => World }[] = [
  { id: "street", name: "Street corner", blurb: "Two people, a parked car and buildings", make: () => build("Street corner", "A quiet city street corner at golden hour.", [
    [{ kind: "shape", shape: "cube" }, [-7, 0, -6], { name: "Building left", size: [8, 14, 8], color: "#6d717c" }],
    [{ kind: "shape", shape: "cube" }, [7, 0, -7], { name: "Building right", size: [8, 18, 8], color: "#5f636d" }],
    [{ kind: "vehicle", vtype: "car" }, [3, 0, -1], { rot: 90 }],
    [{ kind: "person", build: "man" }, [-0.6, 0, 0.6]], [{ kind: "person", build: "woman" }, [0.6, 0, 0.4], { rot: -20 }],
    [{ kind: "object", object: "lamppost" }, [-2.5, 0, -1.5]],
  ], [{ pos: [0, 1.6, 8], look: [0, 1.2, 0] }, { pos: [0, 1.5, 3.5], look: [0, 1.4, 0], lensMm: 50 }]) },
  { id: "room", name: "Living room", blurb: "Sofa, armchair and a seated person", make: () => build("Living room", "A warm modern living room in the evening.", [
    [{ kind: "shape", shape: "wall" }, [0, 0, -2.5], { name: "Back wall", size: [2.5, 1, 1] }],
    [{ kind: "object", object: "velvet-sofa" }, [0, 0, -1.6]], [{ kind: "object", object: "armchair" }, [2, 0, -0.6], { rot: -60 }],
    [{ kind: "object", object: "sidetable" }, [1.1, 0, -1.6]], [{ kind: "person", build: "woman" }, [2, 0, -0.6], { rot: -60, pose: "sitting" }],
  ], [{ pos: [-2.5, 1.4, 4], look: [0.5, 0.8, -1] }, { pos: [1.5, 1.2, 2.5], look: [2, 1, -0.6], lensMm: 50 }], 8, "#1d1b1a", "#3a332c") },
  { id: "summit", name: "Mountain summit", blurb: "Peaks, a pine forest and two climbers", make: () => build("Mountain summit", "Alpine rocky mountains with a pine forest at the base; two climbers stand on the highest summit.", [
    [{ kind: "shape", shape: "cone" }, [0, 0, -40], { name: "Summit", size: [60, 45, 60], color: "#7a7f8a", description: "the highest rocky alpine peak" }],
    [{ kind: "shape", shape: "cone" }, [-45, 0, -55], { name: "Peak left", size: [50, 32, 50], color: "#6f747e" }],
    [{ kind: "shape", shape: "cone" }, [42, 0, -60], { name: "Peak right", size: [55, 36, 55], color: "#6a6f78" }],
    ...[-14, -8, -2, 4, 10, 16].map((x, i): Spec => [{ kind: "object", object: "tree" }, [x, 0, -6 - (i % 2) * 3], { name: `Pine ${i + 1}`, size: [2.5, 3, 2.5] }]),
    [{ kind: "person", build: "man" }, [-0.5, 45, -40], { name: "Climber 1" }], [{ kind: "person", build: "woman" }, [0.6, 45, -40], { name: "Climber 2" }],
  ], [{ pos: [0, 6, 30], look: [0, 10, -20], lensMm: 24 }, { pos: [0, 20, 0], look: [0, 30, -40], lensMm: 24 }, { pos: [6, 48, -34], look: [0, 46, -40], lensMm: 35 }], 14, "#1c2230", "#2b3029") },
  { id: "boat", name: "Boat at sea", blurb: "A day cruiser on open water", make: () => build("Boat at sea", "A white luxury day cruiser on calm Mediterranean water.", [
    [{ kind: "shape", shape: "plane" }, [0, 0.01, 0], { name: "Sea", size: [100, 1, 100], color: "#28465c", description: "calm blue sea" }],
    [{ kind: "vehicle", vtype: "boat" }, [0, 0, 0], { rot: 30 }],
  ], [{ pos: [-12, 4, 12], look: [0, 1, 0], lensMm: 35 }, { pos: [12, 3, 10], look: [0, 1, 0], lensMm: 35 }, { pos: [8, 6, -12], look: [0, 1, 0], lensMm: 28 }], 12, "#22303d", "#1d2e3a") },
];
