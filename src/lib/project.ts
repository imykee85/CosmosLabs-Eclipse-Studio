// The project a user has just named. Real saved projects come later; until then the name is
// remembered in this browser so the workspace can show it.
export const PROJECT_KEY = "eclipse-project-name";

export function saveProjectName(name: string) {
  try { localStorage.setItem(PROJECT_KEY, name); } catch {}
}

export function readProjectName(): string {
  try { return localStorage.getItem(PROJECT_KEY) ?? ""; } catch { return ""; }
}
