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
  "/prompts": "Prompts",
  "/generate": "Video Studio",
  "/voice": "Voice Studio",
  "/connect": "Core",
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
  { title: "Pick an aspect ratio and refine your result" },
  { title: "Keep your work organised in projects" },
];

// The Academy (owner 2026-10-19: "Academy section comes below tutorial"): longer courses under the short lessons. None is published yet, so each shows Soon.
export type Course = { title: string; line: string; video?: string };
export const courses: Course[] = [
  { title: "Prompting like a photographer", line: "Light, lens and composition words that models understand." },
  { title: "Directing a short film", line: "From treatment to storyboard to a finished multi-shot video." },
  { title: "Brand campaigns, start to finish", line: "Keep a product and a look consistent across images and video." },
  { title: "Voice and sound for video", line: "Voiceover, sound effects and music that fit the picture." },
];
