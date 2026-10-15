"use client";

import { useEffect, useState } from "react";
import { I18N_EVENT, translateText } from "@/lib/i18n/translator";

// A sentence in two tones: the words between [[ and ]] are bright, the rest is quiet (emphasis by colour, not by size or weight).
// The sentence is translated whole (markers included) and only then split, so translations keep their own word order; if the markers
// did not survive, the sentence shows plain. The page translator leaves it alone (translate="no"): it is already translated here.
function parts(text: string): { t: string; hi: boolean }[] {
  const out: { t: string; hi: boolean }[] = [];
  const re = /\[\[([\s\S]*?)\]\]/g;
  let last = 0;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (m.index > last) out.push({ t: text.slice(last, m.index), hi: false });
    out.push({ t: m[1], hi: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ t: text.slice(last), hi: false });
  return out.map((p) => ({ ...p, t: p.t.replace(/\[\[|\]\]/g, "") }));
}

export default function Tone({ text, className = "" }: { text: string; className?: string }) {
  const [shown, setShown] = useState(text);
  useEffect(() => {
    const update = () => setShown(translateText(text));
    update();
    window.addEventListener(I18N_EVENT, update);
    return () => window.removeEventListener(I18N_EVENT, update);
  }, [text]);
  return (
    <p className={`tone ${className}`} translate="no">
      {parts(shown).map((p, i) => (p.hi ? <span key={i} className="tone-hi">{p.t}</span> : <span key={i}>{p.t}</span>))}
    </p>
  );
}
