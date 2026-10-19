"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

// Speech to text in the browser (Chrome, Edge, Safari): the mic button on a prompt box. Words are added to the box as they are recognised,
// after whatever was already typed. Shared by Treatment, Prompts and Core.
type Rec = { lang: string; continuous: boolean; interimResults: boolean; start: () => void; stop: () => void; onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null; onend: (() => void) | null; onerror: ((e: { error: string }) => void) | null };
const speechApi = (): (new () => Rec) | null => { const w = window as unknown as Record<string, unknown>; return (w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null) as (new () => Rec) | null; };

export function useDictation(text: string, setText: (v: string) => void, onError: (msg: string) => void) {
  const [listening, setListening] = useState(false);
  const rec = useRef<Rec | null>(null);
  const latest = useRef({ text, setText, onError });
  useLayoutEffect(() => { latest.current = { text, setText, onError }; });

  const toggle = useCallback(() => {
    if (rec.current) { rec.current.stop(); return; }
    const Api = speechApi();
    if (!Api) { latest.current.onError("Voice input is not available in this browser. Try Chrome, Edge or Safari."); return; }
    const r = new Api();
    r.lang = navigator.language || "en-US"; r.continuous = true; r.interimResults = false;
    const base = latest.current.text.trim();
    let said = "";
    r.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) said += `${said ? " " : ""}${e.results[i][0].transcript.trim()}`;
      latest.current.setText(`${base}${base && said ? " " : ""}${said}`);
    };
    r.onerror = (e) => { if (e.error === "not-allowed" || e.error === "service-not-allowed") latest.current.onError("Allow the microphone for this site to talk instead of typing."); };
    r.onend = () => { setListening(false); rec.current = null; };
    try { r.start(); rec.current = r; setListening(true); } catch { latest.current.onError("Voice input could not start."); }
  }, []);
  useEffect(() => () => rec.current?.stop(), []);
  const stop = useCallback(() => rec.current?.stop(), []);
  return { listening, toggle, stop };
}
