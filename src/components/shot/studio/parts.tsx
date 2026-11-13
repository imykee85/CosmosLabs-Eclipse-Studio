"use client";

// Smaller pieces of the ShotMap editor: the scene list (outliner), Add to scene, the inspector, the camera settings popover and the start screen.
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Box, Camera, ChevronDown, ChevronLeft, ChevronRight, Circle, Cone, Copy, Cylinder, Eye, EyeOff, Folder, FolderOpen, Image as ImageIcon, LayoutTemplate, Lock,
  MessageSquare, MoreVertical, Mountain, Pencil, Plus, RotateCcw, Ruler, Search, Square, Trash2, Upload, User, Users, Video, X, Car, Armchair, Focus, LogIn, Unlock, Sailboat,
} from "lucide-react";
import SoonTag from "@/components/SoonTag";
import { PALETTE, POSES, type ColorId, type Pose } from "@/lib/shot/schema";
import { OBJECTS } from "@/lib/shot/setup";
import {
  FSTOPS, FURNITURE_MODELS, LENSES, SHAPES, VTYPES, baseSize, r2, shotOf, type CamKey, type Item, type NewItem, type Vec3, type World,
} from "@/lib/shot/world";
import { TEMPLATES, type ModelEntry, type SceneEntry } from "@/lib/shot/world-store";
import type { RefPick } from "@/components/create/ReferencePicker";

export const label = (p: string) => p.replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase());
const SHAPE_ICON: Record<string, typeof Box> = { cube: Box, sphere: Circle, cylinder: Cylinder, cone: Cone, plane: Square, torus: Circle, wall: Square, floor: Square };
export function itemIcon(it: Item) {
  if (it.kind === "person") return User;
  if (it.kind === "vehicle") return it.vtype === "boat" ? Sailboat : Car;
  if (it.kind === "image") return ImageIcon;
  if (it.kind === "object" || it.kind === "model") return Armchair;
  if (it.id === "floor") return Ruler;
  return SHAPE_ICON[it.shape ?? "cube"] ?? Box;
}

// ---------------- Outliner ----------------
export function Outliner({ world, sel, onSelect, onCamera, onEdit, onDelete, onDuplicate, onAddGroup, onOpenAdd, onCollapse, onRename, onToggleGroup, onMove, onRemoveGroup }: {
  world: World; sel: string | null; onSelect: (id: string) => void; onCamera: (camId: string) => void; onEdit: (id: string, patch: Partial<Item>) => void; onDelete: (id: string) => void;
  onDuplicate: (id: string) => void; onAddGroup: () => void; onOpenAdd: () => void; onCollapse: () => void; onRename: (name: string) => void; onToggleGroup: (id: string) => void;
  onMove: (id: string, groupId: string | null) => void; onRemoveGroup: (id: string) => void;
}) {
  const [menu, setMenu] = useState<string | null>(null);
  const [naming, setNaming] = useState<string | null>(null);
  const active = shotOf(world).cameraId;
  const row = (it: Item, depth = 0) => {
    const Icon = itemIcon(it);
    return (
      <div key={it.id} className={`ss-row${sel === it.id ? " is-sel" : ""}${it.visible ? "" : " is-hidden"}`} style={{ paddingLeft: 10 + depth * 16 }}>
        <button type="button" className="ss-row-main" onClick={() => onSelect(it.id)}>
          <Icon size={14} />
          {it.tint && <span className="ss-dot" style={{ background: it.color }} />}
          {naming === it.id
            ? <input autoFocus defaultValue={it.name} maxLength={60} aria-label="Name" onClick={(e) => e.stopPropagation()} onBlur={(e) => { onEdit(it.id, { name: e.target.value.trim() || it.name }); setNaming(null); }} onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") setNaming(null); }} />
            : <span className="ss-row-name">{it.name}</span>}
          {it.locked && <Lock size={11} className="ss-faint" />}
        </button>
        {it.id === "floor" && <span className="ss-swatch" style={{ background: it.color }} />}
        <button type="button" className="ss-icon" aria-label={it.visible ? `Hide ${it.name}` : `Show ${it.name}`} onClick={() => onEdit(it.id, { visible: !it.visible })}>{it.visible ? <Eye size={13} /> : <EyeOff size={13} />}</button>
        {it.id !== "floor" && <button type="button" className="ss-icon" aria-label={`More for ${it.name}`} onClick={() => setMenu(menu === it.id ? null : it.id)}><MoreVertical size={13} /></button>}
        {menu === it.id && (
          <div className="ss-menu" role="menu" onMouseLeave={() => setMenu(null)}>
            <button type="button" role="menuitem" onClick={() => { setNaming(it.id); setMenu(null); }}><Pencil size={13} /> Rename</button>
            <button type="button" role="menuitem" onClick={() => { onDuplicate(it.id); setMenu(null); }}><Copy size={13} /> Duplicate</button>
            <button type="button" role="menuitem" onClick={() => { onEdit(it.id, { locked: !it.locked }); setMenu(null); }}>{it.locked ? <Unlock size={13} /> : <Lock size={13} />} {it.locked ? "Unlock" : "Lock"}</button>
            {world.groups.length > 0 && <div className="ss-menu-head">Move to group</div>}
            {world.groups.map((g) => <button key={g.id} type="button" role="menuitem" disabled={it.groupId === g.id} onClick={() => { onMove(it.id, g.id); setMenu(null); }}><Folder size={13} /> {g.name}</button>)}
            {it.groupId && <button type="button" role="menuitem" onClick={() => { onMove(it.id, null); setMenu(null); }}><FolderOpen size={13} /> Out of group</button>}
            <button type="button" role="menuitem" className="is-danger" onClick={() => { onDelete(it.id); setMenu(null); }}><Trash2 size={13} /> Delete</button>
          </div>
        )}
      </div>
    );
  };
  const loose = world.items.filter((i) => !i.groupId || !world.groups.some((g) => g.id === i.groupId));
  return (
    <aside className="ss-outliner" aria-label="Scene">
      <div className="ss-side-head"><b>Scene</b><button type="button" className="ss-icon" aria-label="Hide the scene list" onClick={onCollapse}><ChevronLeft size={15} /></button></div>
      <div className="ss-scene-card">
        <Mountain size={16} />
        <div><input className="ss-scene-name" value={world.name} maxLength={80} aria-label="Scene name" onChange={(e) => onRename(e.target.value)} /><small>Virtual set</small></div>
      </div>
      <div className="ss-side-actions">
        <button type="button" onClick={onAddGroup}><Folder size={13} /> New group</button>
        <button type="button" className="is-strong" onClick={onOpenAdd}><Plus size={13} /> Add</button>
      </div>
      <div className="ss-rows">
        {world.cameras.map((c) => (
          <div key={c.id} className="ss-row">
            <button type="button" className="ss-row-main" onClick={() => onCamera(c.id)}><Camera size={14} /><span className="ss-row-name">{c.name}</span>{c.id === active && <span className="ss-tag">Active</span>}</button>
          </div>
        ))}
        {loose.filter((i) => i.id === "floor").map((i) => row(i))}
        {world.groups.map((g) => {
          const kids = world.items.filter((i) => i.groupId === g.id);
          return (
            <div key={g.id}>
              <div className="ss-row">
                <button type="button" className="ss-row-main" onClick={() => onToggleGroup(g.id)} aria-expanded={g.open}>{g.open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}<Folder size={14} /><span className="ss-row-name">{g.name}</span><span className="ss-count">{kids.length}</span></button>
                <button type="button" className="ss-icon" aria-label={`Ungroup ${g.name}`} onClick={() => onRemoveGroup(g.id)}><X size={13} /></button>
              </div>
              {g.open && kids.map((i) => row(i, 1))}
            </div>
          );
        })}
        {loose.filter((i) => i.id !== "floor").map((i) => row(i))}
      </div>
    </aside>
  );
}

// ---------------- Add to scene ----------------
type AddTab = "objects" | "characters" | "shapes" | "images";
export function AddPanel({ onAdd, onAddCamera, onClose, recents, models, onUploadModel, onPickCharacter, onPickImage, characters, onSoon }: {
  onAdd: (n: NewItem) => void; onAddCamera: () => void; onClose: () => void; recents: NewItem[]; models: ModelEntry[]; onUploadModel: (f: File) => void;
  onPickCharacter: () => void; onPickImage: () => void; characters: { id: string; url: string; name: string }[]; onSoon: (what: string) => void;
}) {
  const [tab, setTab] = useState<AddTab>("objects");
  const [q, setQ] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const nameOf = (n: NewItem) => n.kind === "shape" ? SHAPES.find((s) => s.id === n.shape)?.label ?? "Shape" : n.kind === "object" ? (FURNITURE_MODELS.find((m) => m.id === n.object)?.label ?? OBJECTS.find((o) => o.id === n.object)?.label ?? "Object") : n.kind === "vehicle" ? label(n.vtype ?? "car") : n.kind === "person" ? (n.build === "woman" ? "Mannequin (woman)" : "Mannequin") : "Item";
  const gallery = useMemo(() => {
    const furniture: NewItem[] = [...FURNITURE_MODELS.map((m) => ({ kind: "object" as const, object: m.id })), ...OBJECTS.filter((o) => ["table", "chair", "armchair", "sidetable", "bench", "sofa", "bed", "counter"].includes(o.id)).map((o) => ({ kind: "object" as const, object: o.id }))];
    const outdoor: NewItem[] = OBJECTS.filter((o) => !["table", "chair", "armchair", "sidetable", "bench", "sofa", "bed", "counter"].includes(o.id)).map((o) => ({ kind: "object" as const, object: o.id }));
    const vehicles: NewItem[] = VTYPES.map((v) => ({ kind: "vehicle" as const, vtype: v }));
    return [{ title: "Furniture", items: furniture }, { title: "Outdoor and props", items: outdoor }, { title: "Vehicles", items: vehicles }];
  }, []);
  const match = (n: NewItem) => !q.trim() || nameOf(n).toLowerCase().includes(q.trim().toLowerCase());
  const card = (n: NewItem, key: string) => {
    const Icon = n.kind === "vehicle" ? (n.vtype === "boat" ? Sailboat : Car) : n.kind === "person" ? User : n.kind === "shape" ? SHAPE_ICON[n.shape] ?? Box : Armchair;
    return <button key={key} type="button" className="ss-tile" onClick={() => onAdd(n)}><Icon size={22} /><span>{nameOf(n)}</span></button>;
  };
  return (
    <div className="ss-add" role="dialog" aria-label="Add to scene">
      <div className="ss-side-head"><b>Add to scene</b><button type="button" className="ss-icon" aria-label="Close" onClick={onClose}><X size={15} /></button></div>
      <div className="ss-quick">
        <button type="button" onClick={() => onAdd({ kind: "shape", shape: "cube" })}><Box size={16} /><span>Cube</span><kbd>⌥C</kbd></button>
        <button type="button" onClick={() => onAdd({ kind: "person" })}><User size={16} /><span>Mannequin</span><kbd>⌥M</kbd></button>
        <button type="button" onClick={onAddCamera}><Camera size={16} /><span>Camera</span><kbd>⌥K</kbd></button>
      </div>
      {recents.length > 0 && (<>
        <div className="ss-sub">Recent</div>
        <div className="ss-recent">{recents.slice(0, 6).map((n, i) => <button key={i} type="button" onClick={() => onAdd(n)}>{nameOf(n)}</button>)}</div>
      </>)}
      <div className="ss-tabs" role="tablist">
        {(["objects", "characters", "shapes", "images"] as AddTab[]).map((t) => <button key={t} type="button" role="tab" aria-selected={tab === t} className={tab === t ? "is-on" : ""} onClick={() => setTab(t)}>{label(t)}</button>)}
      </div>
      <div className="ss-add-body">
        {tab === "objects" && (<>
          <div className="ss-add-row">
            <button type="button" className="ss-wide" onClick={() => fileRef.current?.click()}><Upload size={15} /> Upload 3D model</button>
            <a className="ss-wide" href="/design" target="_blank" rel="noopener"><ImageIcon size={15} /> Image to 3D</a>
            <input ref={fileRef} type="file" accept=".glb,model/gltf-binary" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) onUploadModel(f); e.target.value = ""; }} />
          </div>
          <label className="ss-search"><Search size={14} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" aria-label="Search objects" /></label>
          {models.length > 0 && (<><div className="ss-sub">Mine</div><div className="ss-grid">{models.filter((m) => !q.trim() || m.name.toLowerCase().includes(q.toLowerCase())).map((m) => <button key={m.key} type="button" className="ss-tile" onClick={() => onAdd({ kind: "model", modelKey: m.key, name: m.name })}><Box size={22} /><span>{m.name}</span></button>)}</div></>)}
          {gallery.map((g) => { const list = g.items.filter(match); return list.length ? <div key={g.title}><div className="ss-sub">{g.title}</div><div className="ss-grid">{list.map((n, i) => card(n, `${g.title}${i}`))}</div></div> : null; })}
        </>)}
        {tab === "characters" && (<>
          <div className="ss-grid">
            <button type="button" className="ss-tile" onClick={() => onAdd({ kind: "person", build: "man" })}><User size={22} /><span>Man</span></button>
            <button type="button" className="ss-tile" onClick={() => onAdd({ kind: "person", build: "woman" })}><User size={22} /><span>Woman</span></button>
            {characters.map((c) => <button key={c.id} type="button" className="ss-tile is-pic" onClick={() => onAdd({ kind: "person", character: c })}><img src={c.url} alt="" /><span>{c.name}</span></button>)}
            <button type="button" className="ss-tile" onClick={onPickCharacter} aria-label="Add a character from your pictures"><Plus size={22} /><span>From Ingredients</span></button>
          </div>
        </>)}
        {tab === "shapes" && <div className="ss-grid">{SHAPES.map((s) => card({ kind: "shape", shape: s.id }, s.id))}</div>}
        {tab === "images" && <div className="ss-grid"><button type="button" className="ss-tile" onClick={onPickImage}><ImageIcon size={22} /><span>2D image</span></button></div>}
      </div>
    </div>
  );
}

// ---------------- Inspector ----------------
function Num({ value, onChange, step = 0.1, label: l }: { value: number; onChange: (v: number) => void; step?: number; label: string }) {
  const [txt, setTxt] = useState(String(r2(value)));
  useEffect(() => setTxt(String(r2(value))), [value]);
  return <label className="ss-num"><span>{l}</span><input inputMode="decimal" value={txt} aria-label={l} onChange={(e) => setTxt(e.target.value)} onBlur={() => { const v = Number(txt); if (Number.isFinite(v)) onChange(v); else setTxt(String(r2(value))); }} onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "ArrowUp" || e.key === "ArrowDown") { e.preventDefault(); onChange(r2(value + (e.key === "ArrowUp" ? step : -step))); } }} /></label>;
}
const AXES = ["X", "Y", "Z"];
export function Inspector({ item, onEdit, onDelete, onClose, gizmo, onGizmo, onLinkCharacter }: {
  item: Item; onEdit: (patch: Partial<Item>) => void; onDelete: () => void; onClose: () => void; gizmo: "translate" | "rotate" | "scale"; onGizmo: (g: "translate" | "rotate" | "scale") => void; onLinkCharacter: () => void;
}) {
  const [tab, setTab] = useState<"transform" | "appearance">("transform");
  const [lockScale, setLockScale] = useState(true);
  const [naming, setNaming] = useState(false);
  const base = baseSize(item), dims: Vec3 = [base[0] * item.scale[0], base[1] * item.scale[1], base[2] * item.scale[2]];
  const setVec = (key: "pos" | "rot" | "scale", i: number, v: number) => {
    const cur = [...item[key]] as Vec3;
    if (key === "scale" && lockScale) { const k = v / (cur[i] || 1); onEdit({ scale: cur.map((x) => r2(Math.max(0.01, x * k))) as Vec3 }); return; }
    cur[i] = key === "scale" ? Math.max(0.01, v) : v; onEdit({ [key]: cur } as Partial<Item>);
  };
  const locked = item.locked && item.id !== "floor";
  return (
    <aside className="ss-inspector" aria-label="Inspector">
      <div className="ss-side-head">
        {naming ? <input autoFocus defaultValue={item.name} maxLength={60} aria-label="Name" onBlur={(e) => { onEdit({ name: e.target.value.trim() || item.name }); setNaming(false); }} onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} /> : <b className="ss-trunc">{item.name}</b>}
        <span className="ss-head-btns">
          <button type="button" className="ss-icon" aria-label="Rename" onClick={() => setNaming(true)}><Pencil size={13} /></button>
          {item.id !== "floor" && <button type="button" className="ss-icon" aria-label={`Delete ${item.name}`} onClick={onDelete}><Trash2 size={13} /></button>}
          <button type="button" className="ss-icon" aria-label="Close the inspector" onClick={onClose}><X size={14} /></button>
        </span>
      </div>
      <div className="ss-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === "transform"} className={tab === "transform" ? "is-on" : ""} onClick={() => setTab("transform")}>Transform</button>
        <button type="button" role="tab" aria-selected={tab === "appearance"} className={tab === "appearance" ? "is-on" : ""} onClick={() => setTab("appearance")}>Appearance</button>
      </div>
      {tab === "transform" ? (
        <div className="ss-insp-body">
          {locked && <p className="ss-faint">Locked. Unlock it in the scene list to move it.</p>}
          <fieldset disabled={locked}>
            <div className="ss-tools" role="group" aria-label="Tool">
              {(["translate", "rotate", "scale"] as const).map((g) => <button key={g} type="button" className={gizmo === g ? "is-on" : ""} aria-pressed={gizmo === g} onClick={() => onGizmo(g)}>{g === "translate" ? "Move" : g === "rotate" ? "Rotate" : "Scale"}</button>)}
            </div>
            <div className="ss-lbl">Position</div>
            <div className="ss-xyz">{AXES.map((a, i) => <Num key={a} label={a} value={item.pos[i]} onChange={(v) => setVec("pos", i, v)} />)}</div>
            <div className="ss-lbl">Rotation <button type="button" className="ss-icon" aria-label="Reset rotation" onClick={() => onEdit({ rot: [0, 0, 0] })}><RotateCcw size={12} /></button></div>
            <div className="ss-xyz">{AXES.map((a, i) => <Num key={a} label={a} step={5} value={item.rot[i]} onChange={(v) => setVec("rot", i, v)} />)}</div>
            <div className="ss-lbl">Scale <button type="button" className={`ss-icon${lockScale ? " is-on" : ""}`} aria-pressed={lockScale} aria-label="Keep proportions" onClick={() => setLockScale((v) => !v)}>{lockScale ? <Lock size={12} /> : <Unlock size={12} />}</button></div>
            <div className="ss-xyz">{AXES.map((a, i) => <Num key={a} label={a} step={0.1} value={item.scale[i]} onChange={(v) => setVec("scale", i, v)} />)}</div>
            <div className="ss-lbl">Dimensions (m)</div>
            <div className="ss-xyz">{AXES.map((a, i) => <Num key={a} label={a} value={dims[i]} onChange={(v) => setVec("scale", i, Math.max(0.01, v) / (base[i] || 1))} />)}</div>
          </fieldset>
        </div>
      ) : (
        <div className="ss-insp-body">
          {(item.kind === "shape" || item.kind === "object" || item.kind === "model") && (<>
            <div className="ss-lbl">Colour</div>
            <div className="ss-colors">{["#c9ccd4", "#8b909c", "#5f636d", "#3a3d46", "#b59b7e", "#7a5c43", "#6f8a6a", "#3e5c78", "#9c4c4c", "#d6c27a"].map((c) => <button key={c} type="button" aria-label={`Colour ${c}`} className={item.color === c ? "is-on" : ""} style={{ background: c }} onClick={() => onEdit({ color: c })} />)}<input type="color" value={item.color} aria-label="Custom colour" onChange={(e) => onEdit({ color: e.target.value })} /></div>
          </>)}
          {(item.kind === "person" || item.kind === "vehicle") && (<>
            <div className="ss-lbl">Colour (names it in the prompt)</div>
            <div className="ss-colors">{PALETTE.filter((c) => c.id !== "grey").map((c) => <button key={c.id} type="button" aria-label={c.id} title={c.id} className={item.tint === c.id ? "is-on" : ""} style={{ background: c.hex }} onClick={() => onEdit({ tint: c.id as ColorId, color: c.hex })} />)}</div>
          </>)}
          {item.kind === "person" && (<>
            <div className="ss-lbl">Build</div>
            <div className="ss-tools">{(["man", "woman"] as const).map((b) => <button key={b} type="button" className={item.build === b ? "is-on" : ""} onClick={() => onEdit({ build: b })}>{label(b)}</button>)}</div>
            <div className="ss-lbl">Pose</div>
            <select className="ss-select" value={item.pose ?? "standing"} aria-label="Pose" onChange={(e) => onEdit({ pose: e.target.value as Pose })}>{POSES.map((p) => <option key={p} value={p}>{label(p)}</option>)}</select>
            <div className="ss-lbl">Character</div>
            {item.character
              ? <div className="ss-char"><img src={item.character.url} alt="" /><span>{item.character.name}</span><button type="button" className="ss-icon" aria-label="Unlink the character" onClick={() => onEdit({ character: undefined })}><X size={13} /></button></div>
              : <button type="button" className="ss-wide" onClick={onLinkCharacter}><Users size={14} /> Link a character picture</button>}
          </>)}
          {item.kind === "vehicle" && (<>
            <div className="ss-lbl">Type</div>
            <select className="ss-select" value={item.vtype ?? "car"} aria-label="Vehicle type" onChange={(e) => onEdit({ vtype: e.target.value as Item["vtype"] })}>{VTYPES.map((v) => <option key={v} value={v}>{label(v)}</option>)}</select>
          </>)}
          <div className="ss-lbl">In the video it is</div>
          <textarea className="ss-text" rows={3} maxLength={400} value={item.description ?? ""} placeholder="A climber in a red jacket, a white day cruiser…" aria-label="What it is in the video" onChange={(e) => onEdit({ description: e.target.value })} />
        </div>
      )}
    </aside>
  );
}

// ---------------- Camera settings ----------------
export function CameraPopover({ camName, k, isActive, canDelete, onEdit, onEnter, onSetActive, onDelete, onClose, focusPicking, onFocusPick }: {
  camName: string; k: CamKey; isActive: boolean; canDelete: boolean; onEdit: (patch: Partial<CamKey>) => void; onEnter: () => void; onSetActive: () => void; onDelete: () => void; onClose: () => void;
  focusPicking?: boolean; onFocusPick?: () => void;
}) {
  return (
    <div className="ss-campop" role="dialog" aria-label="Camera settings">
      <div className="ss-side-head"><span><b>{camName}</b> <small className="ss-faint">· Camera settings · {r2(k.t)} s</small></span>
        <span className="ss-head-btns">{canDelete && <button type="button" className="ss-icon" aria-label="Delete this keyframe" onClick={onDelete}><Trash2 size={13} /></button>}<button type="button" className="ss-icon" aria-label="Close camera settings" onClick={onClose}><X size={14} /></button></span>
      </div>
      <div className="ss-lbl">Viewpoint</div>
      <div className="ss-cam-row">
        <button type="button" className="ss-wide is-strong" onClick={onEnter}><LogIn size={14} /> Enter camera</button>
        <button type="button" className="ss-wide" disabled={isActive} onClick={onSetActive}>{isActive ? "Active" : "Set as active"}</button>
      </div>
      <LensRow k={k} onEdit={onEdit} focusPicking={focusPicking} onFocusPick={onFocusPick} />
    </div>
  );
}
export function LensRow({ k, onEdit, focusPicking, onFocusPick, compact }: { k: Pick<CamKey, "lensMm" | "fStop" | "focusM">; onEdit: (patch: Partial<CamKey>) => void; focusPicking?: boolean; onFocusPick?: () => void; compact?: boolean }) {
  const step = <T extends number>(list: readonly T[], v: number, d: number) => { const i = list.reduce((b, x, n) => (Math.abs(x - v) < Math.abs(list[b] - v) ? n : b), 0); return list[Math.max(0, Math.min(list.length - 1, i + d))]; };
  return (
    <div className={`ss-lens${compact ? " is-compact" : ""}`}>
      {!compact && <div className="ss-lbl">Lens</div>}
      <div className="ss-stepper" aria-label="Focal length"><button type="button" aria-label="Wider lens" onClick={() => onEdit({ lensMm: step(LENSES, k.lensMm, -1) })}><ChevronLeft size={14} /></button><output>{Math.round(k.lensMm)}mm</output><button type="button" aria-label="Longer lens" onClick={() => onEdit({ lensMm: step(LENSES, k.lensMm, 1) })}><ChevronRight size={14} /></button></div>
      <div className="ss-stepper" aria-label="Aperture"><button type="button" aria-label="Wider aperture" onClick={() => onEdit({ fStop: step(FSTOPS, k.fStop, -1) })}><ChevronLeft size={14} /></button><output>f/{k.fStop}</output><button type="button" aria-label="Narrower aperture" onClick={() => onEdit({ fStop: step(FSTOPS, k.fStop, 1) })}><ChevronRight size={14} /></button></div>
      <div className="ss-focus">
        {!compact && <span className="ss-lbl">Focus</span>}
        <input type="range" min={0.3} max={60} step={0.1} value={Math.min(60, k.focusM)} aria-label="Focus distance" onChange={(e) => onEdit({ focusM: Number(e.target.value) })} />
        <output>{k.focusM.toFixed(1)}m</output>
        {onFocusPick && <button type="button" className={`ss-icon${focusPicking ? " is-on" : ""}`} aria-pressed={!!focusPicking} aria-label="Pick the focus point in the scene" onClick={onFocusPick}><Focus size={14} /></button>}
      </div>
    </div>
  );
}

// ---------------- Start screen ----------------
export type StartChoice =
  | { kind: "prompt"; text: string } | { kind: "image"; refs: RefPick[]; text: string } | { kind: "drawing"; frame: string; text: string }
  | { kind: "video"; video: RefPick; text: string } | { kind: "none" } | { kind: "template"; id: string } | { kind: "open"; id: string };
export function StartScreen({ busy, error, scenes, onStart, onPickImages, onPickVideo, picked, video, onDraw, drawing, onClose, onSoon, onDeleteScene }: {
  busy: boolean; error: string; scenes: SceneEntry[]; onStart: (c: StartChoice) => void; onPickImages: () => void; onPickVideo: () => void; picked: RefPick[]; video: RefPick | null;
  onDraw: () => void; drawing: string | null; onClose: () => void; onSoon: (what: string) => void; onDeleteScene: (id: string) => void;
}) {
  const [from, setFrom] = useState<"virtual" | "real">("virtual");
  const [src, setSrc] = useState<"prompt" | "image" | "video" | "none">("prompt");
  const [real, setReal] = useState<"image" | "place" | "upload">("image");
  const [text, setText] = useState("");
  const [templates, setTemplates] = useState(false);
  const can = src === "none" || (src === "prompt" ? !!text.trim() : src === "image" ? picked.length > 0 || !!drawing : !!video);
  const go = () => {
    if (src === "none") onStart({ kind: "none" });
    else if (src === "prompt") onStart({ kind: "prompt", text });
    else if (src === "image") onStart(drawing && !picked.length ? { kind: "drawing", frame: drawing, text } : { kind: "image", refs: picked, text });
    else if (video) onStart({ kind: "video", video, text });
  };
  return (
    <div className="ss-start">
      <header className="ss-start-top">
        <button type="button" className="ss-icon" aria-label="Close" onClick={onClose}><ChevronLeft size={18} /></button>
        <b>New scene</b>
        <button type="button" className="ss-pill" onClick={() => setTemplates((v) => !v)} aria-expanded={templates}><LayoutTemplate size={14} /> Templates</button>
      </header>
      {templates && (
        <div className="ss-templates" aria-label="Templates">
          {TEMPLATES.map((t) => <button key={t.id} type="button" className="ss-template" onClick={() => onStart({ kind: "template", id: t.id })}><b>{t.name}</b><span>{t.blurb}</span></button>)}
        </div>
      )}
      <div className="ss-start-body">
        <div className="ss-sub">Start from</div>
        <div className="ss-from">
          <button type="button" className={from === "virtual" ? "is-on" : ""} aria-pressed={from === "virtual"} onClick={() => setFrom("virtual")}><Box size={20} /><b>Virtual scene</b><span>A simple 3D set you can arrange however you want</span></button>
          <button type="button" className={from === "real" ? "is-on" : ""} aria-pressed={from === "real"} onClick={() => setFrom("real")}><Mountain size={20} /><b>Real environment <SoonTag /></b><span>A photoreal 3D copy of a place that already exists</span></button>
        </div>
        <div className="ss-sub">Source</div>
        {from === "virtual" ? (<>
          <div className="ss-seg" role="tablist">{(["prompt", "image", "video", "none"] as const).map((s) => <button key={s} type="button" role="tab" aria-selected={src === s} className={src === s ? "is-on" : ""} onClick={() => setSrc(s)}>{label(s)}</button>)}</div>
          {src === "image" && (
            <div className="ss-src-row">
              <button type="button" className="ss-wide" onClick={onPickImages}><ImageIcon size={15} /> {picked.length ? `${picked.length} picture${picked.length > 1 ? "s" : ""} chosen` : "Select image"}</button>
              <button type="button" className="ss-wide" onClick={onDraw}><Pencil size={15} /> {drawing ? "Drawing ready" : "Draw your scene"}</button>
            </div>
          )}
          {src === "image" && picked.length > 0 && <div className="ss-thumbs">{picked.map((p) => <img key={p.id} src={p.url} alt={p.label} />)}</div>}
          {src === "image" && drawing && !picked.length && <div className="ss-thumbs"><img src={drawing} alt="Your drawing" /></div>}
          {src === "video" && <button type="button" className="ss-wide" onClick={onPickVideo}><Video size={15} /> {video ? video.label : "Select video"}</button>}
          {src !== "none" && <textarea className="ss-text ss-start-text" rows={src === "prompt" ? 5 : 3} maxLength={4000} value={text} onChange={(e) => setText(e.target.value)} placeholder={src === "prompt" ? "Describe what you want to build" : "Anything the picture does not show (optional)"} aria-label="Describe your scene" />}
          {error && <p className="ss-error" role="alert">{error}</p>}
          <button type="button" className="ss-go" disabled={!can || busy} onClick={go}>{busy ? "Building your scene…" : src === "none" ? "Create empty scene" : "Create virtual scene"}</button>
        </>) : (<>
          <div className="ss-seg" role="tablist">{(["image", "place", "upload"] as const).map((s) => <button key={s} type="button" role="tab" aria-selected={real === s} className={real === s ? "is-on" : ""} onClick={() => setReal(s)}>{label(s)}</button>)}</div>
          {real === "image" && <button type="button" className="ss-wide" onClick={() => onSoon("Real environments from pictures")}><ImageIcon size={15} /> Select images</button>}
          {real === "place" && <button type="button" className="ss-wide" onClick={() => onSoon("Real places")}><Mountain size={15} /> Choose location</button>}
          {real === "upload" && <button type="button" className="ss-drop" onClick={() => onSoon("Uploading a scanned scene")}><Upload size={18} /><b>Drop a .ply or .spz scene here</b><span>PLY or SPZ, up to 500 MB</span></button>}
          {error && <p className="ss-error" role="alert">{error}</p>}
          <button type="button" className="ss-go" onClick={() => onSoon("Real environments")}>Generate 3D scene</button>
        </>)}
        {scenes.length > 0 && (<>
          <div className="ss-sub">Your scenes</div>
          <div className="ss-scenes">{scenes.map((s) => (
            <div key={s.id} className="ss-scene-item">
              <button type="button" onClick={() => onStart({ kind: "open", id: s.id })}><Mountain size={15} /><b>{s.name}</b><span>{new Date(s.at).toLocaleDateString()}</span></button>
              <button type="button" className="ss-icon" aria-label={`Delete ${s.name}`} onClick={() => onDeleteScene(s.id)}><Trash2 size={13} /></button>
            </div>
          ))}</div>
        </>)}
      </div>
    </div>
  );
}

// ---------------- Sketch pad (Draw your scene) ----------------
export function SketchPad({ onDone, onClose }: { onDone: (dataUrl: string) => void; onClose: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  useEffect(() => { const c = ref.current!, g = c.getContext("2d")!; g.fillStyle = "#ffffff"; g.fillRect(0, 0, c.width, c.height); }, []);
  const at = (e: React.PointerEvent) => { const c = ref.current!, r = c.getBoundingClientRect(); return [((e.clientX - r.left) / r.width) * c.width, ((e.clientY - r.top) / r.height) * c.height]; };
  return (
    <div className="ss-modal" role="dialog" aria-label="Draw your scene">
      <div className="ss-modal-card">
        <div className="ss-side-head"><b>Draw your scene</b><button type="button" className="ss-icon" aria-label="Close" onClick={onClose}><X size={15} /></button></div>
        <canvas ref={ref} width={960} height={540} className="ss-sketch"
          onPointerDown={(e) => { drawing.current = true; (e.target as Element).setPointerCapture(e.pointerId); const g = ref.current!.getContext("2d")!, [x, y] = at(e); g.beginPath(); g.moveTo(x, y); }}
          onPointerMove={(e) => { if (!drawing.current) return; const g = ref.current!.getContext("2d")!, [x, y] = at(e); g.lineWidth = 4; g.lineCap = "round"; g.strokeStyle = "#111"; g.lineTo(x, y); g.stroke(); }}
          onPointerUp={() => { drawing.current = false; }} />
        <div className="ss-cam-row">
          <button type="button" className="ss-wide" onClick={() => { const c = ref.current!, g = c.getContext("2d")!; g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height); }}>Clear</button>
          <button type="button" className="ss-wide is-strong" onClick={() => onDone(ref.current!.toDataURL("image/jpeg", 0.85))}>Use drawing</button>
        </div>
      </div>
    </div>
  );
}
