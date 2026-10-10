import { clerkEnabled } from "./clerk-enabled";

export type Project = { id: string; name: string; createdAt?: string; updatedAt: string; deletedAt: string | null };

export type ProjectDetails = {
  id: string; name: string; createdAt?: string; updatedAt: string; deletedAt: string | null;
  images: { count: number; bytes: number }; binned: { count: number; bytes: number }; unmeasured: number;
  canvas: { nodes: number; bytes: number; updatedAt: string } | null; totalBytes: number;
};

// With Clerk + a database connected, projects live on the server per user.
// Without keys (demo mode) they are kept in this browser so the flow can be tried.
const LOCAL_KEY = "eclipse-projects";
const CURRENT_KEY = "eclipse-project";

function readLocal(): Project[] {
  try { return JSON.parse(localStorage.getItem(LOCAL_KEY) ?? "[]"); } catch { return []; }
}
function writeLocal(list: Project[]) {
  try { localStorage.setItem(LOCAL_KEY, JSON.stringify(list)); } catch {}
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { ...init, headers: { "Content-Type": "application/json" } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Something went wrong. Please try again.");
  return data as T;
}

export async function listProjects(): Promise<Project[]> {
  return clerkEnabled ? api<Project[]>("/api/projects") : readLocal();
}

export async function createProject(name: string): Promise<Project> {
  if (clerkEnabled) return api<Project>("/api/projects", { method: "POST", body: JSON.stringify({ name }) });
  const p: Project = { id: crypto.randomUUID(), name, updatedAt: new Date().toISOString(), deletedAt: null };
  writeLocal([p, ...readLocal()]);
  return p;
}

export async function renameProject(id: string, name: string) {
  const clean = name.trim();
  if (!clean || clean.length > 60) throw new Error("Enter a project name (up to 60 characters).");
  if (clerkEnabled) await api(`/api/projects/${id}`, { method: "PATCH", body: JSON.stringify({ action: "rename", name: clean }) });
  else writeLocal(readLocal().map((p) => (p.id === id ? { ...p, name: clean, updatedAt: new Date().toISOString() } : p)));
  // The workspace top bar shows the open project's name, so keep it in step.
  if (readCurrentProject()?.id === id) setCurrentProject({ id, name: clean });
}

export async function getProjectDetails(id: string): Promise<ProjectDetails> {
  if (clerkEnabled) return api<ProjectDetails>(`/api/projects/${id}/details`);
  const p = readLocal().find((x) => x.id === id);
  if (!p) throw new Error("Project not found");
  return { ...p, images: { count: 0, bytes: 0 }, binned: { count: 0, bytes: 0 }, unmeasured: 0, canvas: null, totalBytes: 0 };
}

export async function trashProject(id: string) {
  if (clerkEnabled) return void (await api(`/api/projects/${id}`, { method: "PATCH", body: JSON.stringify({ action: "trash" }) }));
  writeLocal(readLocal().map((p) => (p.id === id ? { ...p, deletedAt: new Date().toISOString() } : p)));
}

export async function restoreProject(id: string) {
  if (clerkEnabled) return void (await api(`/api/projects/${id}`, { method: "PATCH", body: JSON.stringify({ action: "restore" }) }));
  writeLocal(readLocal().map((p) => (p.id === id ? { ...p, deletedAt: null, updatedAt: new Date().toISOString() } : p)));
}

export async function deleteProjectForever(id: string) {
  if (clerkEnabled) return void (await api(`/api/projects/${id}`, { method: "DELETE" }));
  writeLocal(readLocal().filter((p) => p.id !== id));
}

// The project the user is working in right now (shown in the workspace top bar).
export function setCurrentProject(p: Pick<Project, "id" | "name">) {
  try { localStorage.setItem(CURRENT_KEY, JSON.stringify(p)); } catch {}
  window.dispatchEvent(new Event("eclipse-project-change"));
}
export function readCurrentProject(): { id: string; name: string } | null {
  try { const p = JSON.parse(localStorage.getItem(CURRENT_KEY) ?? "null"); return p?.id ? { id: p.id, name: p.name ?? "" } : null; } catch { return null; }
}
export function clearCurrentProject() {
  try { localStorage.removeItem(CURRENT_KEY); } catch {}
}
export function readCurrentProjectName(): string {
  try { return JSON.parse(localStorage.getItem(CURRENT_KEY) ?? "null")?.name ?? ""; } catch { return ""; }
}

export function timeAgo(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  const units: [number, string][] = [[60, "minute"], [3600, "hour"], [86400, "day"], [604800, "week"], [2629800, "month"], [31557600, "year"]];
  let u = units[0];
  for (const x of units) if (s >= x[0]) u = x;
  const n = Math.floor(s / u[0]);
  return `${n} ${u[1]}${n === 1 ? "" : "s"} ago`;
}
