// The Tutorial button remembers which page it was clicked on, so the page can offer a way back
// named after it (Dashboard, Studio, Create, ...). Only these known app pages are accepted.
const ORIGINS: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/project": "Studio",
  "/create": "Image Studio",
  "/gallery": "Gallery",
  "/library": "Library",
  "/ingredients": "Ingredients",
  "/canvas": "Canvas",
  "/agents": "Agents",
  "/assets": "Assets",
  "/treatment": "Treatment",
  "/generate": "Generate",
  "/connect": "Orbit",
  "/memory": "Memory",
  "/skills": "Skills",
  "/tools": "Tools",
  "/avatars": "Avatars",
  "/portfolio": "Portfolio",
  "/certificates": "Certificates",
  "/settings": "Settings",
};

export function tutorialHref(from: string) {
  return `/tutorial?from=${encodeURIComponent(from)}`;
}

export function resolveOrigin(from?: string): { path: string; label: string } {
  const path = from && from in ORIGINS ? from : "/dashboard";
  return { path, label: ORIGINS[path] };
}

export type Lesson = { title: string; video?: string };

// Add a `video` path (files go in public/tutorial/) to switch a lesson's Watch button on.
export const lessons: Lesson[] = [
  { title: "Write your first prompt and create an image" },
  { title: "Pick a shape and refine your result" },
  { title: "Keep your work organised in projects" },
];
