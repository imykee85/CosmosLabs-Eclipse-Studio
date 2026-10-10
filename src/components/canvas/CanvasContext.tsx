"use client";

import { createContext, useContext } from "react";

// Lets a node ask the canvas to fly the camera to it (the header button works on phones where double-tap is awkward), or to open the Library
// picker for an ingredient node (the picker is drawn by the canvas, outside the zoomed and moved node layer).
export const CanvasCtx = createContext<{ focus: (id: string) => void; pickPicture: (id: string) => void }>({ focus: () => {}, pickPicture: () => {} });
export const useCanvas = () => useContext(CanvasCtx);
