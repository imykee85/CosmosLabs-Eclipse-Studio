// Demo-mode profile (no Clerk keys): kept in this browser. With Clerk connected the real user is used instead.
export type DemoProfile = { name: string; avatar?: string };

const KEY = "eclipse-profile";
const EVENT = "eclipse-profile-change";

export function readDemoProfile(): DemoProfile {
  try { return { name: "Demo User", ...JSON.parse(localStorage.getItem(KEY) ?? "{}") }; } catch { return { name: "Demo User" }; }
}

export function writeDemoProfile(p: Partial<DemoProfile>) {
  try { localStorage.setItem(KEY, JSON.stringify({ ...readDemoProfile(), ...p })); } catch {}
  window.dispatchEvent(new Event(EVENT));
}

export const DEMO_PROFILE_EVENT = EVENT;

// Shrink a chosen image to a small square so it fits comfortably in browser storage.
export function squareDataUrl(file: File, size = 256): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = size;
      const ctx = canvas.getContext("2d");
      const s = Math.min(img.width, img.height);
      ctx?.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("That image could not be read.")); };
    img.src = url;
  });
}
