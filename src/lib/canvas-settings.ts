"use client";

import { useCallback, useEffect, useState } from "react";

// How the canvas feels, kept in this browser for every canvas.
export type EdgeStyle = "bezier" | "smoothstep" | "step" | "straight";
export type CanvasSettings = {
  helperLines: boolean; // alignment lines and snapping while dragging a node
  edge: EdgeStyle;      // the shape of wires
  wheel: "zoom" | "pan"; // what the mouse wheel / trackpad scroll does
};
export const DEFAULT_SETTINGS: CanvasSettings = { helperLines: true, edge: "bezier", wheel: "zoom" };
const KEY = "eclipse-canvas-settings";

export function readSettings(): CanvasSettings {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    return {
      helperLines: typeof raw.helperLines === "boolean" ? raw.helperLines : DEFAULT_SETTINGS.helperLines,
      edge: ["bezier", "smoothstep", "step", "straight"].includes(raw.edge) ? raw.edge : DEFAULT_SETTINGS.edge,
      wheel: raw.wheel === "pan" ? "pan" : "zoom",
    };
  } catch { return DEFAULT_SETTINGS; }
}

export function useCanvasSettings(): [CanvasSettings, (patch: Partial<CanvasSettings>) => void] {
  const [s, setS] = useState<CanvasSettings>(DEFAULT_SETTINGS);
  useEffect(() => setS(readSettings()), []);
  const update = useCallback((patch: Partial<CanvasSettings>) => {
    setS((cur) => {
      const next = { ...cur, ...patch };
      try { localStorage.setItem(KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);
  return [s, update];
}
