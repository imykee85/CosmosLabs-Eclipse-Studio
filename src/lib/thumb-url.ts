import type { SyntheticEvent } from "react";

// Tile pictures load the small cached copy (/thumb); if that address fails (preview mode, a picture not stored with us), the
// image falls back once to the full link it was given.
export const thumbOf = (type: "render" | "upload", id: string) => `/api/${type === "render" ? "generations" : "uploads"}/${id}/thumb`;
export const fallbackTo = (full: string | null | undefined) => (e: SyntheticEvent<HTMLImageElement>) => {
  const el = e.currentTarget;
  if (full && el.dataset.fell !== "1") { el.dataset.fell = "1"; el.src = full; }
};
