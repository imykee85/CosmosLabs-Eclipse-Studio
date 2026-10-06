"use client";

import { createContext, useContext } from "react";

// Lets a node ask the canvas to fly the camera to it (the header button works on phones where double-tap is awkward).
export const CanvasCtx = createContext<{ focus: (id: string) => void }>({ focus: () => {} });
export const useCanvas = () => useContext(CanvasCtx);
