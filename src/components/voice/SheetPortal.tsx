"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/** Draws a sheet on the page body so no stacking context in the page column can put it under the docked console or tab bar.
 *  The wrapper carries the app theme colours (`.a-theme`), which otherwise live only inside `.ws-root`. */
export default function SheetPortal({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  return ready ? createPortal(<div className="a-theme">{children}</div>, document.body) : null;
}
