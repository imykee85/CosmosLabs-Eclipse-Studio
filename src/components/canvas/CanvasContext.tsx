"use client";

import { createContext, useContext } from "react";

// What a node can ask of the canvas. The pickers and the add menu are drawn by the canvas itself, outside the zoomed and moved node layer.
export type AskRequest =
  | { kind: "picture"; nodeId: string }   // choose a Library picture for a Character, Product or Scene node
  | { kind: "refs"; nodeId: string }      // choose reference pictures for a generator
  | { kind: "model"; nodeId: string }     // open the model sheet for a generator
  | { kind: "details"; genId: string }    // show a finished image with its details
  | { kind: "agent"; anchor: DOMRect };   // the list of agents, above the Agent chip that asked

type Ctx = {
  focus: (id: string) => void;                                  // fly the camera to a node (the header button works on phones where double-tap is awkward)
  ask: (r: AskRequest) => void;
  addAfter: (id: string, anchor: DOMRect) => void;              // the + on a node's output: add the next node, already connected
  addBefore: (id: string, anchor: DOMRect) => void;             // the + on a generator's input: add a node that feeds it
};

export const CanvasCtx = createContext<Ctx>({ focus: () => {}, ask: () => {}, addAfter: () => {}, addBefore: () => {} });
export const useCanvas = () => useContext(CanvasCtx);
