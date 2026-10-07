// The last Studio or dashboard page you were on, so pages outside them (Settings, Portfolio, ...) can send you back to it.
const KEY = "eclipse-last-page";
const OK = ["/dashboard", "/project", "/create", "/gallery", "/library", "/ingredients", "/canvas", "/agents", "/assets", "/treatment", "/connect", "/memory", "/skills"];

export function rememberPage(path: string) {
  if (!OK.includes(path.split("?")[0])) return;
  try { sessionStorage.setItem(KEY, path + (typeof window !== "undefined" && path === window.location.pathname ? window.location.search : "")); } catch {}
}

export function readLastPage(): string {
  try {
    const p = sessionStorage.getItem(KEY);
    if (p && OK.includes(p.split("?")[0])) return p;
  } catch {}
  return "/dashboard";
}
