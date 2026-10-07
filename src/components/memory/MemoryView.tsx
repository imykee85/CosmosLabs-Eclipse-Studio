"use client";

import { ArrowUp, Brain, Folder, Heart, Package, Palette, Plus, Upload, User } from "lucide-react";
import "./memory.css";

// Memory: what Eclipse will remember about you and your work, so every new chat starts informed. Nothing is stored yet:
// the map below is a preview of the shape it will take (hub, topics, remembered items), and adding or importing is "Soon".
const TOPICS = [
  { name: "Projects", icon: <Folder size={20} />, x: 40, y: 38 },
  { name: "Products", icon: <Package size={20} />, x: 76, y: 45 },
  { name: "Characters", icon: <User size={20} />, x: 20, y: 52 },
  { name: "Style", icon: <Palette size={20} />, x: 76, y: 63 },
  { name: "Tastes", icon: <Heart size={20} />, x: 40, y: 70 },
];
// Faint placeholders for the things that will hang off each topic: [topic index, x, y, width %]
const PILLS: [number, number, number, number][] = [
  [0, 25, 5, 32], [0, 64, 4, 26], [0, 3, 30, 22],
  [1, 82, 24, 24], [1, 92, 36, 26], [1, 96, 49, 20],
  [2, -4, 41, 18], [2, -6, 62, 22], [2, 5, 76, 28],
  [3, 92, 70, 22], [3, 88, 86, 26], [3, 64, 90, 22],
  [4, 8, 84, 30], [4, 24, 94, 26], [4, 48, 95, 20],
];

export default function MemoryView() {
  return (
    <div className="mm-wrap">
      <div className="mm-top">
        <span className="mm-title"><Brain size={18} /> Memory</span>
        <button type="button" className="mm-import" disabled title="Importing is coming soon"><Upload size={15} /> Import <em>Soon</em></button>
      </div>

      <div className="mm-stage" aria-hidden="true">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none">
          {TOPICS.map((t) => <line key={t.name} x1={50} y1={52} x2={t.x} y2={t.y} />)}
          {PILLS.map(([i, x, y, w], k) => <line key={k} x1={TOPICS[i].x} y1={TOPICS[i].y} x2={x + w / 2} y2={y} />)}
        </svg>
        {PILLS.map(([, x, y, w], k) => <i key={k} className="mm-pill" style={{ left: `${x}%`, top: `${y}%`, width: `${w}%` }} />)}
        {TOPICS.map((t) => <span key={t.name} className="mm-node" style={{ left: `${t.x}%`, top: `${t.y}%` }} title={t.name}>{t.icon}</span>)}
        <span className="mm-orb" />
      </div>

      <div className="mm-copy">
        <h1>Your creative memory</h1>
        <p>Learning from every project</p>
      </div>

      <form className="mm-add" onSubmit={(e) => e.preventDefault()}>
        <button type="button" className="mm-plus" disabled aria-label="Attach" title="Coming soon"><Plus size={18} /></button>
        <input disabled placeholder="Add a memory (coming soon)" aria-label="Add a memory" />
        <button type="submit" className="mm-send" disabled aria-label="Save memory" title="Coming soon"><ArrowUp size={18} /></button>
      </form>
    </div>
  );
}
