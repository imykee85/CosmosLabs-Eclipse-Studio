# CANVAS V2 (parked, do NOT build until the owner asks for "canvas v2")

Saved 2026-10-21 at the owner's request: "keep it and name it canvas v2, that's what I'll request when I need it". The owner's brief is kept below exactly as pasted. Read Part D first when it is requested. Never raise this in PVU, FVU, to-do lists or suggestions until the owner says "canvas v2".

---

# Eclipse CANVAS — Build Brief for Claude Code

> **Stage: LAST.** Standing rule: do **not** touch Canvas or Agents until every earlier stage (pricing, credits ledger, free-trial protection, providers, sandbox smoke test) is finished and passing. Read this file now, build it last.
> **Source:** SIX tutorial videos of a reference product (Part A = the first video, Part B at the very end = five more videos that go deeper and CORRECT some details; where they disagree, **Part B wins over A, and Part C (three more videos, at the very end) wins over both**). The first video was a 5-minute tutorial of a reference product ("Spaces" by Magnific). I watched all 308 s as 308 frames at 1 fps plus on-screen text (OCR) plus the narration (partly transcribed, see §16). Everything below tagged **[SEEN]** was visible in the video. Everything tagged **[DESIGN]** is my engineering decision to make it work in Eclipse. Everything tagged **[NOT SHOWN]** the video did not demonstrate, so use your judgement and keep it simple.
> **Branding:** this is Eclipse's own feature, called **Canvas**. Do **not** copy Magnific's name, logo, copy text, colors or icons. Copy the *behaviour*, not the skin. Use Eclipse's design tokens.

> **READ PART D FIRST (end of file).** It overrides everything above on two points: (1) this brief is a **gap-fill and improvement list, not a rebuild**: audit Eclipse first and reuse what exists; (2) Canvas must work **fully on both mobile and desktop**, like the rest of Eclipse.

---

## 0. What Canvas is, in one paragraph

An infinite, pannable, zoomable dot-grid board. The user drops **nodes** on it (Assistant/LLM, Image Generator, Video Generator, Text, Media, Stock, List, Voiceover, Sound Effects, Image Upscaler, etc.). Each node has **typed ports**. The user drags a **connection line** from one node's output port into another node's input port, so one node's output (a prompt, an image, a video) feeds the next node. Pressing **Run** on a node executes it, spending Eclipse credits through the existing ledger. The result is a saved, shareable project ("a Canvas") that is a complete creative workflow, instead of opening each tool one at a time.

Why it matters for Eclipse: it ties together everything already built (chat models, image models, video models, audio, upscaler) in one place and increases credit spend per session.

---

## 1. Scope and phases

| Phase | Ships | Notes |
|---|---|---|
| **C1 (MVP)** | Canvas list page, create/rename/delete, infinite canvas, 5 node types (Text, Assistant, Image Generator, Video Generator, Media/Upload), connections, run single node, run downstream, credit hold/settle, autosave, undo/redo, zoom menu, minimap, toolbar, selection toolbar | Must be usable on desktop. |
| **C2** | Node picker with search/categories, List, Voiceover, Sound Effects, Image Upscaler, Image Editor, Variations, Stock, Assets (history) nodes, groups/frames, sticky notes, connection cut tool, settings modal + shortcuts, page tabs | |
| **C3** | Share link (view/edit), comments, templates gallery, "Getting started" tiles, feedback dialog, collaborators | |
| **C4** | Real-time multi-user cursors, version history | Optional, only if asked. |

Build C1 fully before starting C2. Each phase ends with the tests in §15.

---

## 2. Screens (all [SEEN] unless marked)

### 2.1 Canvas home (`/canvas`)
- Three tabs: **My canvases**, **Shared with me**, **Templates**. A **search bar** to filter by name. A primary **New canvas** button that creates a canvas and opens it directly.
- Grid of cards (thumbnail snapshot, name, last edited). [SEEN: tabs + search + New button; card layout is DESIGN]
- Entry points [SEEN]: from the main tools/home page there is both a dedicated "Canvas" tab and an item inside "All tools". Mirror both in Eclipse nav.

### 2.2 Canvas editor (`/canvas/[id]`)
Layout, all overlaid on a full-screen dot grid (dark background, faint dot grid that scales with zoom):

| Region | Contents | Source |
|---|---|---|
| **Top-left breadcrumb** | Back arrow `<`, project icon, "Canvases" (parent), `>`, canvas name. Click the name to **rename inline**. | [SEEN] (e.g. "Spaces Course > Untitled Space", later renamed "Navigation") |
| **Top-right** | White **Share** button, then circular **avatar** that opens the account menu | [SEEN] |
| **Left vertical toolbar** (floating pill, vertically centred-left) | top to bottom: **Add node (+)**, **Select (pointer)**, **Pan (hand)**, **Connection tools (scissors icon with small corner triangle = has a flyout)**, **Group/Frame/Note (square-with-fold icon, corner triangle = flyout)**, **Comments (speech bubble)**, **Undo**, **Redo (disabled/greyed until available)**, **Settings (gear)** | [SEEN] |
| **Bottom-left** | **Page switcher** chip ("Page 1") with a small page icon | [SEEN] |
| **Bottom-right** | **Give feedback** (chat icon), **Minimap toggle** (map icon), **Zoom percentage with dropdown caret** (e.g. "109%") | [SEEN] |
| **Centre empty state** | See §2.3 | [SEEN] |

Tooltips show the action name **and its single-letter shortcut** in a small chip, e.g. "Add node  N", "Connection  L". Controlled by the "Rich tooltips" setting (§9).

### 2.3 Empty state: "Your canvas is ready"
Centered over a faint particle-ring animation (circle of tiny dots) [SEEN]:
- Title: **"Your space is ready"** (Eclipse: **"Your canvas is ready"**), subtitle **"Choose your first node and start creating"**.
- Three pill tabs under it: **Start from scratch** (active), **Getting Started**, **Templates**.
- Under "Start from scratch", five tiles in a row, each icon + title + one-line description [SEEN]:
  1. **Stock** — "Browse stock photos to spark ideas"
  2. **Media** — "Bring your uploaded files into the canvas"
  3. **Image Generator** — "Generate images from a text prompt"
  4. **Video Generator** — "Generate videos from a text prompt"
  5. **Assistant** — "Craft and refine prompts with AI"
- Clicking a tile drops that node in the middle of the viewport and hides the empty state. The empty state returns only when the canvas has zero nodes.
- **Getting Started** and **Templates** tabs: [NOT SHOWN contents] → Getting Started = 2-3 tiny pre-built example graphs; Templates = same data as the Templates tab on the home page.

### 2.4 Account menu (avatar popover) [SEEN]
Header: avatar + plan name ("… Premium") + masked email line; blue **Upgrade** button; outlined **Create your team**; **Credit usage** block with a progress bar and "Spent X / Available Y"; then rows: **Plan & billing** (with plan badge), **Settings**, **Creator profile**, **My collections**, **Language** (dropdown), **Theme** (dropdown, Dark shown), **Help center**, **Log out**.
→ Eclipse already has an account menu. **Reuse the existing one**; just make sure the credit bar reads from the ledger (§8). Do not rebuild.

### 2.5 Share modal [SEEN]
Title "Share this space" (Eclipse: "Share this canvas"), close X. Copy: "To collaborate…you can use shared projects with a Teams plan or invite others with an invite link." An invite link field (truncated URL), a permission dropdown (**Can view** shown; add **Can edit**), blue **Copy invite link** button. Section **People with access** listing the owner with an "Owner" label. See §11.

### 2.6 Comments panel [SEEN]
Opens at top-right under the avatar. Title "Comments", X, a **search** input ("Search comments…"), filter tabs **All / Open / Resolved** (Open selected), empty state icon + **"No comments yet"** + **"Click anywhere on the canvas to leave one."** See §12.

### 2.7 Feedback dialog [SEEN]
Light modal "Help us improve Spaces": text "Spaces is in early preview, and we'd love to hear what you think. Share what's working well or what could be better." Textarea, email input, **camera** button (screenshot) and **video** button (record), blue **Send feedback**. → Eclipse: a simple textarea + email prefilled from Clerk + Send. Screenshot/video attach are optional (C3). Store in a `CanvasFeedback` table and surface in `/admin`.

---

## 3. Node anatomy

All nodes share one frame component. [SEEN]

- **Rounded rectangle card**, dark fill slightly lighter than canvas, 1 px subtle border, ~16 px radius.
- **Header label above the card**, top-left, with a small type icon and an auto-numbered title: **"Assistant #1"**, **"Image Generator #1"**. Numbering increments per type per canvas. Title is editable (the pencil icon seen beside "Assistant" in the first frame means rename). Without numbers later: "Text", "Image Generator", "Video Generator" in the example graph.
- **Input ports** on the left edge, **output ports** on the right edge, as small round buttons, ~24 px, containing a **type glyph** (a "T-in-box" for text, a picture icon for image). Ports sit half outside the card border.
- **Selected state:** 2 px **blue outline** around the card (hex ≈ #3B82F6 family; use Eclipse accent), and a **floating toolbar above the card** (see §3.1). Unselected = grey border.
- **Hover:** if "Rich tooltips" is on, hovering shows a short description.
- **Drag** the card by its body/header to move. **Resize**: [NOT SHOWN, but Image/Video nodes visibly have different sizes in the example], so allow resize by corner handles with aspect lock for media nodes.
- **Loading state:** the first frame at 0:05 shows a node as a skeleton (grey blurred pill placeholders for the controls). Use skeleton while a node hydrates.
- **Z-order:** selected node comes to front.

### 3.1 Floating selection toolbar (above the selected node) [SEEN]
Icons left to right: **Run (play triangle) with small dropdown caret** → run options (Run this node / Run this node + downstream / Run all upstream) · **Connection icon with caret** (connection options: delete connections, reroute) · **Edit/rename icon** (pencil-in-box) · **Delete (trash)** · **More (…)** (duplicate, copy, paste, bring to front, download output, lock, etc. [DESIGN list]).

### 3.2 Side action icons [SEEN]
A round **image icon** floats just outside the node's right edge (top right) on selected Image Generator = "send/add output as Media or new downstream node" shortcut. [DESIGN] Click = spawn a Media node pre-linked to this output; drag = start a connection.

---

## 4. Node types

Build these as a registry so adding a node is one file. Fields per node type: `type`, `title`, `icon`, `inputs[]`, `outputs[]`, `params schema (zod)`, `defaultSize`, `estimateCost(params, inputs)`, `run(ctx)`.

### 4.1 Assistant (LLM) — [SEEN]
- Card shows a **two-tab mini switcher** at the top-left (icon 1 = text/prompt mode selected, icon 2 = sparkle/"enhance" mode). [DESIGN meaning: tab 1 = free chat/prompt; tab 2 = prompt improver]
- Placeholder body copy: **"Assistant is your creative sidekick—powered by a large language model. You can type a prompt, or even use images for context. It understands what you mean, builds on your ideas, and helps you move faster."** (write Eclipse's own wording.)
- Bottom row: **Model dropdown** (shows "GPT-5 Mini" in the video; Eclipse default = **Auto** which maps to Sonnet + prompt caching per the pricing master), a **settings gear** (temperature, system prompt, max length), an **Export as text ▾** dropdown (output format: text / list / JSON [DESIGN]) and a round **Run (play)** button.
- Accepts text and images as context (inputs: `text`, `image[]`). Output port: **text**.
- Output is rendered in the card body after run; editable by the user (then it acts like a Text node).

### 4.2 Text — [SEEN, in the demo at 5:00]
Plain editable text card, header "Text". One output port (**text**), shown with a **green/teal** connector colour in the demo. Used to hold a prompt or note.

### 4.3 Image Generator — [SEEN]
- Header "Image Generator #1". Body is the **preview area** (empty dark square until generated).
- Bottom prompt box: placeholder **"Describe the image you want to generate…"**. When a text node is connected the placeholder becomes **"Connected prompt. Use @ to add references or extra context"**. `@` opens a mention menu of upstream outputs/assets.
- Bottom control strip: **− x1 +** (number of images per run, stepper), **Auto ▾** (model; "Auto" = Eclipse picks a cheap default), **aspect-ratio ▾** with a small square glyph (shows "1:1"), **gear** (advanced: resolution, seed, negative prompt), **Run (play)**.
- Ports: input **text** (left, upper), input **image** (left, below it, for reference images), output **image** (right, shown as a floating image icon).
- Cost badge on the Run button [DESIGN]: shows "n credits" before running (§8).

### 4.4 Video Generator — [SEEN in the demo at 5:00+]
Same pattern as image: preview area, prompt box ("text prompt"), model dropdown, duration, resolution, aspect ratio, audio on/off, run. Inputs: **text**, **image** (start frame), optional **image** (end frame), **audio**. Output: **video**. In the demo it is fed by an Image Generator output (image→video) and a Text node (prompt), and it plays the result inline.

### 4.5 Media — [SEEN as quick-start tile; "Upload / Assets / Stock" in picker]
Brings in a file. Three sources [SEEN in picker "MEDIA" section]: **Upload** (from device), **Assets** (the user's own history in Eclipse; reuse content from earlier generations), **Stock** (stock library search). Output port typed by file (image/video/audio).

### 4.6 Stock — [SEEN]
Opens the stock search used elsewhere in Eclipse. **[DESIGN] Eclipse has no stock library today, so in C1 hide this tile. Show it only if/when a stock provider is added.** Keep the registry entry flagged `enabled: false`.

### 4.7 Other nodes listed in the node picker [SEEN names; behaviours DESIGN]
From the first picker (right-side search list): **Image Generator, Video Generator, List, Voiceover, Sound Effects, Image Upscaler, Music Generator** (partially hidden at bottom). From the full picker (left of toolbar): sections **MEDIA** (Upload, Assets, Stock), **REFERENCES** (Add Reference), **IMAGE** (Image Generator, Image Upscaler, Image Editor, Variations, Designer…), and tab icons for categories: All, Media, Assistant/AI, Image, Video, Audio, Text, Tools. In the "Basics" list: **Text, Image Generator, Video Generator, Image Upscaler** plus Upload / Assets / Stock.

| Node | What it does | Maps to existing Eclipse capability |
|---|---|---|
| **List** | Holds N text items; downstream node runs once per item (batch/fan-out). | New: fan-out executor (§6.4) |
| **Voiceover** | text → speech | existing TTS (Seed/Qwen etc.) |
| **Sound Effects** | text → SFX | existing audio provider |
| **Music Generator** | text → music | existing audio provider if present, else hide |
| **Image Upscaler** | image → bigger image | existing upscaler |
| **Image Editor** | image + instruction → edited image | existing image-edit models |
| **Variations** | image → N variations | image model with image reference |
| **Add Reference** | style/character reference image input for generators | reference support on image models |
| **Designer** | [NOT SHOWN] | skip |

Only build nodes for features Eclipse already has. Anything missing: `enabled:false`.

---

## 5. Connections (the core mechanic)

### 5.1 Creating a connection [SEEN]
1. Hover a node: output port appears on its right edge.
2. **Drag from the output port**. A **dashed curved line** follows the cursor.
3. **Release on empty canvas** → a **node-picker popover opens at the release point** (search box + list: Image Generator, Video Generator, List, Voiceover, Sound Effects, Image Upscaler, Music Generator…; footer hints "↑↓ Navigate · ↵ Insert"). Choosing a node creates it **already connected** to the source.
4. **Release on a compatible input port** of an existing node → solid connection created.
5. Incompatible ports: highlight red / reject with a small toast [DESIGN].

### 5.2 Visual style [SEEN]
- Curve = **cubic bezier** (setting "Edge path type": **Bezier** (default) or **Pointed/Polyline**). Build both.
- Colour = by **data type**: text ≈ **green/teal** (seen on the Text→Video line), image ≈ **purple/violet** (Assistant→Image line looked purple-blue), video/audio: pick distinct hues [DESIGN].
- Line goes **from the right edge of the source to the left edge of the target**, ports on each end as the small circular type-glyph buttons.
- **Selected/active** connection is brighter and thicker. While dragging, it's dashed.

### 5.3 Rules [DESIGN]
- Output → many inputs allowed. Each input accepts one connection, except multi-inputs (image refs, List) which accept many.
- **No cycles** (reject if the new edge creates a path back to the source; show toast "That would create a loop").
- Type check: `text→text`, `image→image`, `video→video`, `audio→audio`, `text→assistant context`, `image→assistant context`.
- When the source node is re-run, downstream nodes are marked **stale** (small dot on their header) but **not** auto-run (to protect credits).

### 5.4 Cut tool [SEEN]
Toolbar icon = **scissors with corner triangle → flyout** with a **"Connection" item, shortcut "L"** (the flyout row showed the connection icon; scissors button highlighted in white when active). In cut mode, **drag a line across a connection to delete it** (a thin white slash trail appears, seen at 3:26 as a small tick near the line). Esc or Select tool exits. Also: click a connection + Delete key removes it.

---

## 6. Execution engine

### 6.1 Graph model
`nodes[]` (id, type, position, size, params, output refs, status) and `edges[]` (id, sourceNodeId, sourcePort, targetNodeId, targetPort).
Node status: `idle | stale | queued | running | succeeded | failed | cancelled`.

### 6.2 Run actions
- **Run node**: collects inputs from upstream **already-produced outputs**. If an upstream node has no output, either run it first (prompt the user: "Run upstream too? total N credits") or fail with a clear message.
- **Run downstream / Run all** (from the play dropdown) [SEEN caret]: topological order, parallel where independent, a single combined cost confirm if total > threshold (default 20 credits).
- **Stop**: cancel queued/running jobs for the node; release unused hold.

### 6.3 Jobs
Reuse Eclipse's existing generation pipeline (the same one the standalone tools use). A Canvas node run = create a normal `Generation` row tagged `source='canvas'`, `canvasId`, `nodeId`. Results saved to R2 like any generation and also appear in the user's History/Assets (so the **Assets** node can reuse them). Poll via existing job status or push via SSE/Pusher-equivalent already in the app. Do **not** build a second job system.

### 6.4 List fan-out [DESIGN]
List node with N items feeding a generator → the generator runs N times, produces N outputs (shown as a stacked/paged gallery in the card). Cost = N × single cost; always confirm before running.

### 6.5 Idempotency
Each run carries a client-generated `runId`. Double-clicks, retries and network blips must not double-charge (see §8).

---

## 7. Canvas interactions and navigation [SEEN, from the whole video]

| Action | Behaviour |
|---|---|
| **Pan** | Hand tool (H) drag; or **mouse wheel pans by default** (setting "Mouse wheel: Pan / Zoom"); space+drag; two-finger trackpad scroll pans |
| **Zoom** | **Pinch / Ctrl+scroll** (when wheel=Pan) or plain scroll (when wheel=Zoom). Zoom menu at bottom-right: **Zoom in** (⌘+), **Zoom out** (⌘−), **Zoom 100%** (⌘0), **Zoom to fit** (D? shown "D"), **Zoom to selection** (F). Percentage label shows current zoom (100%, 109%, 125% seen). Range suggested 10%–400%. |
| **Minimap** | Toggle via map icon (bottom-right). A small panel (bottom-right, ~160×90) shows nodes as grey rectangles and the viewport; click/drag inside it to jump. |
| **Select** | Pointer tool (V); click selects, shift-click adds, **drag a marquee** to multi-select; "selection mode" when holding **Shift** with scroll [SEEN in settings text: "Zoom: Ctrl+scroll… Hold Shift to switch to selection mode"]. |
| **Pan with hand tool** | Cursor shows a hand while active; toolbar icon highlights white. |
| **Add node** | + button or **N** opens the node picker anchored to the toolbar (left side) |
| **Delete** | Delete/Backspace on selected nodes or edges |
| **Undo / Redo** | Toolbar buttons + ⌘Z / ⇧⌘Z. Redo greyed until there is something to redo [SEEN]. |
| **Duplicate / copy / paste** | ⌘D, ⌘C, ⌘V [DESIGN] |
| **Group / Frame / Sticky note** | Toolbar button with flyout [SEEN icon with corner triangle]: **Frame/Group** (draggable titled rectangle that contains nodes), **Note** (sticky text) [DESIGN specifics] |
| **Helper lines** | Alignment guides while dragging a node near others' edges/centres (setting "Helper lines") |

---

## 8. Credits integration (follow the pricing master brief exactly)

**Do not invent any new pricing for Canvas.** Every node uses the same credit prices as the standalone tools (see `eclipse-PRICING-MASTER-brief.md`).

1. **Estimate before run.** Each node exposes `estimateCost()` using the pricing table (tenths-of-a-credit ledger). Show it on the Run button/tooltip and in the Run-all confirm.
2. **Hold → settle.** On run, place a **hold** for the estimate on the ledger inside a DB transaction (check balance, write hold). On success, **settle** the exact cost (video rounded up once per clip, images per render). On failure/cancel, **release** the hold. Never leave a hold open > 30 min (cleanup job).
3. **Idempotency key** = `canvasId:nodeId:runId`.
4. **Free trial users** (2 free images only, per the free-trial protection brief): Canvas may be opened, but only **Image Generator on cheap models** is runnable on trial; every other node shows the subscription prompt. Free-trial counters and kill switches apply to Canvas runs too. Reuse the same guard function, do not copy it.
5. **Insufficient credits:** block the run, show the standard top-up/subscribe modal.
6. **Expiry rules:** plan credits expire at period end; top-ups last 90 days and are spendable only while subscribed (per the expiry addendum). Canvas uses the same spend order, no special case.
7. **Account menu credit bar** (see §2.4) reads the same ledger.
8. **Daily budget / kill switches** (`FREE_DAILY_BUDGET_USD`, `ROUTE_*` flags) apply to Canvas runs.

---

## 9. Settings modal (gear on the left toolbar) [SEEN at 2:50–3:10]

Modal with left nav **General | Shortcuts** and a close X.

**General**
- **Helper lines** — toggle (on) — "Display alignment guides when moving elements on the canvas"
- **Rich tooltips** — toggle (on) — "Show detailed previews when hovering over elements"
- **Experimental tools** — toggle (off) — "Enable early-access tools that are still in development"
- **Edge path type** — radio **Bezier / Pointed** — "Choose the visual style for connection lines between elements"
- Section **Media:** **Autoplay videos** — toggle (off) — "Automatically play video previews on the canvas"
- Section **Navigation:** **Mouse wheel** — radio **Pan / Zoom** — "Pan: Traditional navigation where scrolling moves the canvas. Zoom: CAD-style navigation where scrolling zooms in/out; hold Shift to switch to selection mode."

**Shortcuts** tab: a list of every shortcut. [shortcut tab contents NOT fully legible; use the table below as the source of truth]

| Key | Action |
|---|---|
| N | Add node (open picker) |
| V | Select tool |
| H | Hand / pan tool |
| L | Connection (cut) tool |
| C | Comment tool [DESIGN] |
| ⌘Z / ⇧⌘Z | Undo / redo |
| ⌘+ / ⌘− / ⌘0 | Zoom in / out / 100% |
| D | Zoom to fit |
| F | Zoom to selection |
| Delete | Remove selection |
| ⌘D / ⌘C / ⌘V | Duplicate / copy / paste |
| Esc | Cancel connection drag / close menus / back to Select |
| Enter | Insert highlighted node in picker |
| ↑ ↓ | Navigate picker |

Settings persist per user (DB column on user settings, with localStorage fallback).

---

## 10. Node picker popover [SEEN]

- Opens from: **+ toolbar button / N** (anchored left of canvas) and **dropping a connection on empty canvas** (anchored at the drop point).
- Search input at the top ("Search"), auto-focused.
- **Category icon row** (All, Media, AI/Assistant, Image, Video, Audio, Text, Tools): filters the list.
- **Grouped sections** with small uppercase headers: MEDIA (Upload, Assets, Stock), REFERENCES (Add Reference), IMAGE (Image Generator, Image Upscaler, Image Editor, Variations, …), then VIDEO, AUDIO, TEXT/BASICS.
- Each row: coloured square icon + name. Image icons are indigo, video green, audio teal, etc.
- Footer hints: **N Open · ↑↓ Navigate · ↵ Insert**.
- When opened from a connection drop, **only show nodes whose inputs accept the source type**.
- Keyboard: type to filter, arrows move, Enter inserts, Esc closes.

---

## 11. Sharing, permissions, collaboration

- **Invite link**: per-canvas random token, `Can view` (read-only canvas, can duplicate to own account) or `Can edit` (C4: realtime; C3: last-write-wins with revision check).
- **People with access**: list with roles Owner / Editor / Viewer. Remove access button for owner.
- **Teams** [SEEN copy: shared projects need a Teams plan]. Eclipse has no Teams plan. Use "invite link" only and drop the Teams sentence.
- Viewing a shared canvas never spends the viewer's credits; **running** nodes spends **the runner's** credits, and runners need edit permission.
- **Shared with me** tab on the home page lists canvases the user opened via a link or was invited to.
- Rate-limit link views; links revocable (regenerate token).

---

## 12. Comments

- **Comment tool** (speech bubble). Click anywhere on canvas to drop a pin; a small composer opens (textarea + Send). Pins are anchored to canvas coordinates, or to a node if clicked on one (move with the node).
- **Panel** (top-right): search, tabs **All / Open / Resolved**, list of threads (author avatar, snippet, time, node chip). Click a thread → pan/zoom to the pin. Resolve / reopen / delete (author or owner). Replies (thread).
- Mentions and notifications: [NOT SHOWN] skip for C3; add email notification later.

---

## 13. Templates, pages, home polish

- **Templates**: canvases saved as read-only blueprints (`isTemplate=true`, curated by admin). "Use template" duplicates into the user's canvases. Seed 3: *Prompt → Image*, *Image → Video*, *Text → Image → Video* (the demo at the end of the video: a Text node "Rally car pursuing an ATV across desert dunes, kicking up sand." feeding an Image Generator, whose image feeds a Video Generator that plays the clip — **use this exact flow as the flagship template**, own prompt wording).
- **Pages** (bottom-left "Page 1"): a canvas holds multiple pages (tabs) [SEEN chip only]. C2: list/add/rename/delete pages; each page has its own nodes/edges/viewport.
- **Autosave**: debounce 800 ms after any change; show "Saving… / Saved" indicator near the breadcrumb [DESIGN]; save viewport (pan/zoom) per page.
- **Thumbnail** for the home card: render at save or on idle (html-to-image of the viewport or a server render of node previews).

---

## 14. Tech design for Eclipse (Next.js, TS, Tailwind, Clerk, Prisma/Neon, R2)

### 14.1 Library
Use **`@xyflow/react` (React Flow v12)**. It provides: infinite pan/zoom, custom nodes with typed handles, bezier/step edges, minimap, marquee selection, snapping/helper lines, viewport control, edge reconnect, and keyboard handling. Everything in §3–§7 maps onto it. Keep node UI in our own components styled with Tailwind + Eclipse tokens. Client-only (`'use client'`, dynamic import with `ssr:false`).

### 14.2 Prisma models (suggested)
```prisma
model Canvas {
  id          String   @id @default(cuid())
  ownerId     String            // Clerk user id
  name        String   @default("Untitled canvas")
  isTemplate  Boolean  @default(false)
  thumbnailUrl String?
  shareToken  String?  @unique
  sharePerm   CanvasPerm @default(VIEW)  // VIEW | EDIT
  revision    Int      @default(0)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  pages       CanvasPage[]
  comments    CanvasComment[]
  members     CanvasMember[]
  @@index([ownerId, updatedAt])
}
model CanvasPage {
  id        String @id @default(cuid())
  canvasId  String
  name      String @default("Page 1")
  position  Int
  viewport  Json   // {x,y,zoom}
  graph     Json   // {nodes:[], edges:[]}  (schema-versioned)
  schemaVer Int    @default(1)
  canvas    Canvas @relation(fields:[canvasId], references:[id], onDelete: Cascade)
}
model CanvasMember { id String @id @default(cuid()) canvasId String userId String role CanvasRole /* OWNER|EDITOR|VIEWER */ @@unique([canvasId,userId]) }
model CanvasComment { id String @id @default(cuid()) canvasId String pageId String authorId String parentId String? nodeId String? x Float y Float body String resolved Boolean @default(false) createdAt DateTime @default(now()) }
model CanvasFeedback { id String @id @default(cuid()) userId String? email String? body String createdAt DateTime @default(now()) }
```
`Generation` (existing) gets nullable `canvasId`, `nodeId`, `runId`. Store the **graph as JSON per page** (simple, atomic, versioned) — do not normalise nodes/edges into rows in C1.

### 14.3 Node data shape (JSON inside `graph.nodes`)
```ts
type CanvasNode = {
  id: string; type: NodeType; position: {x:number;y:number}; size?: {w:number;h:number};
  data: { title: string; params: Record<string,unknown>;
          output?: { kind:'text'|'image'|'video'|'audio'; value?: string; urls?: string[]; generationIds?: string[] };
          status: NodeStatus; lastRunId?: string; error?: string; stale?: boolean }
}
type CanvasEdge = { id:string; source:string; sourceHandle:string; target:string; targetHandle:string }
```

### 14.4 API routes
- `GET/POST /api/canvas` list/create · `GET/PATCH/DELETE /api/canvas/[id]` · `PUT /api/canvas/[id]/pages/[pageId]` (save graph, **optimistic concurrency via `revision`**, return 409 on conflict)
- `POST /api/canvas/[id]/run` body `{nodeId, runId, mode:'node'|'downstream'|'all'}` → creates holds + Generations, returns job ids
- `POST /api/canvas/[id]/cancel` · `GET /api/canvas/[id]/events` (SSE) for status/output updates
- `POST /api/canvas/[id]/share` (create/rotate token, set perm) · `GET /api/canvas/shared/[token]`
- `GET/POST /api/canvas/[id]/comments`, `PATCH/DELETE …/[commentId]`
- `POST /api/canvas/feedback`
- All routes: Clerk auth, ownership/role check, zod validation, rate limits.

### 14.5 Client structure
`app/canvas/page.tsx` (home), `app/canvas/[id]/page.tsx` (editor shell), `components/canvas/*`: `CanvasEditor`, `Toolbar`, `NodePicker`, `NodeFrame`, `nodes/<Type>Node.tsx`, `edges/TypedEdge.tsx`, `SelectionToolbar`, `ZoomMenu`, `MiniMap`, `SettingsModal`, `ShareModal`, `CommentsPanel`, `FeedbackDialog`, `EmptyState`. State: Zustand store for graph + UI, with an **undo/redo history stack** (cap 100 snapshots, coalesce drags). Server state via React Query.

### 14.6 Performance
- Virtualise: React Flow `onlyRenderVisibleElements`. Video nodes pause when off-screen; **autoplay off by default** (setting). Images use R2 thumbnails/`next/image`.
- Don't store base64 in the graph; only URLs/ids.
- Graph JSON size limit ~1 MB; warn beyond.

### 14.7 Security
Validate every param server-side against the node schema; never trust client cost. Canvas run recomputes cost on the server. Prompt/injection: outputs of Assistant nodes are **data**, never executed. Sanitise rendered text. Per-user concurrent-run cap (e.g. 6). Share links never expose owner email.

### 14.8 Mobile
Mike works from iPhone. **C1: view + light edit on mobile** (pan/pinch, run nodes, edit prompts); full wiring is desktop-first. Make the toolbar bottom-docked on small screens; picker as a bottom sheet. Don't block touch panning with node drag (use handles/long-press to drag).

---

## 15. Acceptance tests (must pass per phase)

**C1**
1. Create canvas → empty state shows five tiles (Stock hidden) → click Assistant → node appears centred, titled "Assistant #1".
2. Drag Assistant output to empty space → picker opens at drop point → choose Image Generator → node created and connected; line is bezier, coloured by type.
3. Dragging output onto an incompatible input is rejected; creating a cycle is rejected.
4. Type prompt in Assistant, Run → text appears; Image Generator placeholder changes to "Connected prompt…"; Run → image appears; balance drops by exactly the estimate; ledger shows hold→settle with one idempotency key.
5. Double-click Run fast → exactly **one** charge.
6. Provider failure → hold released, balance unchanged, node `failed` with message.
7. Reload page → graph, viewport, outputs restored. Edit in two tabs → second save gets 409 and merges/reloads.
8. Undo/redo restores node moves, deletions, connections; redo disabled when empty.
9. Zoom menu items and shortcuts work; minimap jump works; wheel pan/zoom setting switches behaviour.
10. Free-trial user: only cheap Image Generator runs; others show subscription prompt; trial counter shared with the standalone tool.
11. Insufficient credits blocks the run with the standard modal.
12. Another user cannot read/edit a canvas they have no access to (403/404).

**C2–C3**: node picker search/category filter/keyboard; cut tool deletes connections; settings persist; share link view/edit; viewer cannot run; comments create/resolve/filter; templates duplicate correctly; page tabs; autosave indicator.

---

## 16. Confidence notes (read this)

- **Fully verified from frames:** screens, toolbar icons and order, node card layout, labels/placeholder text, selection toolbar, connection behaviour (dashed drag → picker → solid line), picker contents, settings toggles and defaults, zoom menu items and shortcuts shown (⌘+, ⌘−, ⌘0, D, F), share modal, comments panel, feedback dialog, account menu, minimap, final demo graph (Text → Image Generator → Video Generator).
- **Narration:** transcribed from 0–150 s only (home page, New Space, starter options, navigation intro). Remaining narration was not transcribed in time; nothing in this brief depends on words I did not hear. Details like exact shortcuts for Comments/Frame, the contents of the Shortcuts tab and the flyout items of the Frame/Note button were **not legible** and are marked DESIGN.
- **Not shown in the video:** node resize, run options menu contents, real-time collaboration, version history, pricing/credits inside Canvas. These follow Eclipse's own rules.
- **Hard constraints:** build last; reuse the existing ledger, generation pipeline, providers and free-trial guard; no new pricing; Eclipse naming and styling.

## 17. Owner decisions still needed from Mike (ask once, before C1)
1. Name: keep **Canvas**? (Default: yes.)
2. Stock library: skip for now? (Default: yes, hidden.)
3. Run-all confirm threshold in credits (Default: 20).
4. Mobile: view + light edit only in C1? (Default: yes.)


---
---

# PART B — Additions and corrections from five more tutorials

**Videos covered (all watched as frames every 3 s, plus on-screen text):** (1) *How to add and find nodes* (259 s), (2) *Understanding nodes and connections* (347 s), (3) *Generating and editing images in a workflow* (367 s), (4) *Expanding an image workflow with Variations* (367 s), (5) *Connecting images to video generation* (297 s).
**Limits:** narration was **not transcribed** for these five (speech-to-text was too slow on this machine), so everything below comes from what is on screen. A few 18-second windows in videos 3 and 4 were skimmed rather than studied. Tags: **[SEEN]** on screen, **[DESIGN]** my decision for Eclipse, **[UNCLEAR]** could not be read, use judgement.
**Rule:** Part B overrides Part A where they differ. The "Eclipse mapping" notes say how to fit each thing to what Eclipse already has. Build order is still §1 phases; Part B items are tagged C1/C2/C3.

---

## B1. Corrections to Part A (read first)

| # | Part A said | Correct (Part B) |
|---|---|---|
| 1 | Picker has "Basics" list only + a few sections | The picker has **8 category tabs and 9 sections** (see B3). Typing searches **model names too** and inserts a pre-configured node. |
| 2 | Connection errors: "reject with a toast" | The toast is **red, top-right, two lines: "Incompatible data types" / "Cannot connect text to image"** (pattern: `Cannot connect {from} to {to}`). Has an X. [SEEN] |
| 3 | Generator output port is "the image icon outside the node" | Confirmed, and **ports are type-coloured circles** with a type glyph: text = "T in a box", image = picture glyph, video = camera glyph, audio = waveform glyph. Hovering a port shows a small **tooltip chip with the type name** ("Text", "Reference", "End image", "Audio input", "References"). [SEEN] |
| 4 | "Run" is a play button | Run button sits **inside the node, bottom-right** (round, grey play). While running it becomes a **white round stop (square) button**. After a result exists it becomes a **circular refresh/regenerate icon**. The play/dropdown in the floating toolbar above the node is a second way to run. [SEEN] |
| 5 | Edge colours "text green, image purple" | **Text → purple/violet line; image → blue line.** The Text-node → Video-node line in video 1 looked teal because it was un-selected/dimmed. Use: text violet, image blue, video and audio get their own hues [DESIGN]. When not selected, lines are dim; selected = bright. [SEEN] |
| 6 | Image Generator inputs: text, image | Image Generator has **two left ports: Text (upper) and Reference image (lower, tooltip "Reference")**. Multiple images may connect to Reference; the port then shows a **numeric badge** (e.g. "2"). [SEEN] |
| 7 | Edit/"Image Editor" node is a vague idea | It is a real node, **"Edit image #n"**, with a fixed toolbar (B6). It also exists as a **full-screen Image Editor** opened from any image (B7). |
| 8 | "Variations → N variations" | Variations is a rich node with **6 modes** and a **List** output (B8). |
| 9 | List node = fan-out of N text items | List is **bidirectional**: it can hold **text prompts** (feeds a generator in batch) OR **images** (receives the split output of Variations/batch runs). See B9. |
| 10 | Zoom/pan only | Add: text-node **resize handle**, **rich-text toolbar** on Text node, **fullscreen viewer** for results, and **"Added to space" toasts** (B5, B7). |

---

## B2. Interface pieces newly confirmed

### B2.1 Text node (full spec) [SEEN, videos 2, 4, 5]
- Header: small "T-in-box" icon + **"Text #n"**. Click a node anywhere to select; double-click or click inside to edit.
- **Placeholder (empty):** `Try "Happy dog with sunglasses and floating ring"` (write your own example).
- **Rich-text toolbar floats above the node when it is selected/editing:** left-to-right: **"run-forward" icon (double play, runs this node's downstream)**, **format/clear icon**, **text-colour dot with caret**, **"Paragraph ▾" block-style dropdown**, **B**, **I**, **bullet list**, **numbered list**, **horizontal rule (–)**, **a small "shapes/variables" icon** (insert variable or reference [UNCLEAR → DESIGN: insert `@` mention]).
- Text wraps and **scrolls inside the card**; long text fades at the bottom edge. **Resize by dragging the bottom-right corner** (a curved resize cursor was visible). Selected = blue outline; unselected = grey border.
- Output port on the right: round **violet T-glyph**. Tooltip "Text".
- Stores rich text as HTML or ProseMirror/TipTap JSON; when sent to a model, **flatten to plain text**. Use **TipTap** (StarterKit) [DESIGN].
- Real demo prompts in the videos were long (6–15 lines). Cap at 8,000 chars [DESIGN].

### B2.2 "Connected prompt" behaviour [SEEN]
When a Text (or Assistant) output is connected to a generator's text port, the generator's own prompt box is **replaced by a faded line: "Connected prompt. Use @ to add references or extra context"**. Typing `@` lets the user mention upstream assets. The connected text is the prompt; extra typed context is **appended** [DESIGN].

### B2.3 Generating / queued / finishing states [SEEN]
- **Queued:** small grey text inside the card, bottom-left: **"Image in queue…"** (video: "Video in queue…").
- **Running:** card gets a **soft glowing purple/blue animated border**; label **"Generating image…"** with an **elapsed timer ("13s")**; the run button becomes a **white stop button**.
- **Video, near the end:** **"Finishing up…"** with a teal-to-purple gradient glow.
- **Cancel tooltip (hover stop):** *"Canceling, it's possible that some credits were used."* → show this honestly in Eclipse too (hold released only for unused portion [DESIGN]).
- **Done:** result fills the card edge to edge, with a **dimension badge top-right** (e.g. `1344 × 768`, `864 × 1184`, `3072 × 5504`; video: `1920 × 1080   00:09` plus a small speaker icon). Prompt/controls remain visible as a faint overlay at the bottom of the card ("Connected prompt…" line + the control row), brightening on hover/selection.
- **Multi-output (x2+):** small **grid badge top-left with the count (⊞ 2)** and **‹ › pager arrows**; click opens a gallery view with thumbnails (the selected one outlined blue and tagged "Selected").

### B2.4 Floating toolbar above a selected node (expanded) [SEEN]
Icons differ by node and state. With a **finished image node**: ▶ run (with ▾ options) · connection tool (▾) · **expand/fullscreen** · **edit** · **copy/duplicate** · **upscale** · **download** · **delete** · **⋯ more**. With a **Variations node**: also a **split-grid** icon (tooltip "split-grid"). With an **empty node**: ▶ ▾ · connection ▾ · edit · delete · ⋯ . A tooltip shows the action name on hover.

### B2.5 Toasts [SEEN]
Top-right stacked toasts, auto-dismiss ~4 s, X to close: **red** for errors ("Incompatible data types"), **green check** for success: **"Added to space"** (two stacked when two items added).

### B2.6 Header rename icon [SEEN]
Hover over a node title shows a small **pencil**; click to rename. Titles are `Type #n` by default.

### B2.7 Breadcrumb [SEEN]
`‹  [project icon] Project name  ›  Canvas name`. The canvas name changes per tutorial ("How to add and find nodes", "Understanding nodes and connections", etc.), confirming **inline rename**. Account bar right: **Share** (white), a pink **Upgrade** text-button on free plans, avatar. → In Eclipse show **"Upgrade"** only to free/trial users [DESIGN].

---

## B3. Node picker — complete spec [SEEN, video 1]

**Opening:** `+` toolbar button, or key **N**, or drag a connection onto empty canvas (then it is anchored at the drop point). Closes on Esc or click outside.

**Header:** auto-focused **Search** field with a clear (x) button when text is present.

**Category tab row (8 icons, tooltip on hover, the active one highlighted):**
1. **All** (grid icon) 2. **Media** (stacked frames) 3. **References** (a "style" icon) 4. **Image** 5. **Video** 6. **Audio** (note) 7. **Text** (T box) 8. **Utilities** (pencil/ruler). Placeholder changes with the tab: "Search", "Search media", "Search image", "Search audio", "Search text", "Search utilities".
**Quick-start variant (centre of empty canvas):** a separate compact bar **All | Image | Video | Audio | 3D** was shown in video 5's intro. [UNCLEAR] → treat as the same filter in a compact form; skip 3D.

**Sections and rows (in order) [SEEN]:**
| Section | Rows |
|---|---|
| **BASICS** | Text · Image Generator · Video Generator · Assistant · Image Upscaler · List |
| **MEDIA** | Upload · Assets · Stock |
| **REFERENCES** | Add Reference |
| **IMAGE** | Image Generator · Image Upscaler · Image Editor · Variations · Designer *(badge: New)* · Image to SVG · SVG Generator |
| **VIDEO** | Video Generator · Speak · Video Combiner · Video Upscaler · Media Extractor *(New)* |
| **AUDIO** | Voiceover · Sound Effects · Music Generator |
| **TEXT** | Text · Assistant |
| **UTILITIES** | List · Sticky note · Stickers · Group |

Section headers are small **uppercase grey labels**. Each row = **coloured rounded icon tile** (image = indigo, video = green, audio = teal, text = violet, utilities = grey/orange for SVG) + name; **"New" pill** at right for new items. Hover/keyboard-highlighted row has a lighter background. The list **scrolls** with a fade at the bottom edge. **Footer bar:** `N Open   ↑↓ Navigate   ↵ Insert`.

**Hover preview card [SEEN]:** hovering a row for ~0.5 s opens a **preview card to the right/below** with a small **looping thumbnail** of a sample graph, the node **name**, a one-line **description** and **tag chips**. Example (List): *"Create multiple variations at once. Process batches of prompts, images, or videos in parallel."* chips **Batch**, **Multi-outputs**. For a model row the card shows the provider logo, the model name and a **credit range pill (e.g. "75–190")**.
→ Eclipse: write one-line descriptions for each node; show a credit range from the pricing master [DESIGN].

**Search behaviour [SEEN]:**
- Typing **"image"** shows grouped results: group **Image Editor** (Adjust, Change camera angle, Image edit, Image Extender, Relight, Remove background) then group **Image Generator** (Auto, Cinematic, Classic, … = style presets/models). Each row shows a **small sub-label** (the node family, e.g. "Image Editor").
- Typing **"google"** while the *Utilities* tab is active shows *"No results found in Utilities"* and a **"Search in all"** button; then **"17 ITEMS IN ALL"** with rows like **Google Imagen 3 / 4 / 4 Fast / 4 Ultra, Google Nano Banana / 2 (New) / Pro, Google Lyria (music), Google Veo 2 / 3 / 3 Fast / 3.1 / 3.1 Fast / 3.1 Lite (video)**; each has the node family as sub-label (Image Generator, Music Generator, Video Generator).
- **Choosing a model row inserts the node with that model pre-selected** (an Image Generator showing "Google Imagen 3" in its model chip was created). 
→ Eclipse: index = node types + **every enabled model from the pricing master**. Result row = `{ nodeType, modelId, label, sublabel }`. Only enabled models (ROUTE_* flags) appear.

**When opened from a connection drop [SEEN]:** the list is a **short context list** with no section headers: Image Generator · Video Generator · List · Voiceover · Sound Effects · Image Upscaler · Music Generator (from a Text output); from an image output it also shows **Assistant, Speak, Variations**, etc. → filter by type compatibility (rule in §5.3). Search box on top, same footer. The popover is small (about 240 px wide) and appears right of the cursor.

**Tabs inside the picker are also filters for models:** Audio tab lists Voiceover, Sound Effects, Music Generator and then models: **ElevenLabs v2, ElevenLabs v3, Gemini 2.5 Pro (Voiceover), Google Lyria, ElevenLabs Music** (each with sub-label). Eclipse equivalents: its own TTS/music models.

**Special insert items:**
- **Upload** → opens the OS file dialog, creates a Media node with the chosen file. 
- **Assets** → opens the **Assets browser** modal (B4). 
- **Stock** → stock browser (Eclipse: hidden in C1).
- **Add Reference** → reference browser (B4); [DESIGN] in C1, implement as "upload a reference image" node.

---

## B4. Assets / References browser modal [SEEN, video 1]
Large centred modal over the dimmed canvas, title area top-left, a **search bar** at the top, close X.
- **Left sidebar:** group **Creations**: *[Project] (current space), History, Uploads*. Group **All references**: *Stock, Style, Character, Element, Structure, Effects, Camera, Color palette* (each with a small icon; some have a pin icon).
- **History view:** thumbnails of the user's past generations grouped by month ("April 2026", "March 2026"), grid of ~8 per row; right column: *"Drop an image or upload your own media."* with **Upload media** and **Take photo** buttons.
- **Style view:** tabs **Featured · My Styles · All · Photo · Illustration · 3D · Design**, a **"New style"** button, grid of style tiles with a leading **shuffle "All styles"** tile and hashtag-labelled tiles ("#photo", "#natural", "#editorial", "#earthy", "#softhue", "#b&w").
- **Effects view:** chips **All · Color · Lighting · Mood · Action**.
- **Color palette view:** chips **All · Cold · Neon · Pastel · Vibrant · Warm**, each tile a row of 3–5 colour swatches with a name (blueandyellow, greenforest, frozenmist, minty, blueberry, coldspring…).
- **Structure view:** reference tiles (shapes/architecture).
→ **Eclipse C1:** implement only **History + Uploads** (the user's own Eclipse generations from the `Generation` table + uploaded files). Selecting an item inserts a Media node. **C3+:** styles/effects/palettes are out of scope unless you already have style presets. Do not copy their library contents.

---

## B5. Media / "Creation" nodes and the viewer [SEEN, videos 3–4]
- When an image is **sent to the board** (from a gallery item, a generator output, or Upload/Assets), the node is titled by its **filename or "Creation #n"** (a long auto name like `magnific_moody-cinematic-medium-sh_2656626218`). Eclipse: use the generation title/id.
- A Media node shows the image full-bleed, a **dimension badge** (`5504 × 3072`) top-right, and a **"Replace"** pill bottom-left (swap the file). One **image output port** on the right.
- **Fullscreen viewer:** clicking an image opens a large modal: a thin header bar with **× close**, a **title** ("Image Generator #1", "List #1", "Variations #3"), and at right **actions**: **open-in-new (↗)**, **info (i)**, **edit/brush**, **add-to-space (copy icon)**, **download**; a small **"100%"** zoom badge bottom-right; the prompt text and model chip ("Google Nano Banana · 16:9") appear in a caption under the image. **Esc closes**. For lists/grids it first shows a **thumbnail grid**, click one to enlarge, **‹ ›** to navigate; the one chosen is tagged **"Selected"**.
- **"Added to space"** toast after add-to-space; the new node is placed to the right of the source.

---

## B6. Edit image node (new node type `image-edit`) [SEEN, video 3]
**Title:** "Edit image #n". **Input:** one image port (left, lower). **Output:** image port right-top. Shows a **small thumbnail of the source image at the card's top-right**.
**Bottom controls (two rows):**
- Row 1: **aspect ratio dropdown** (shows `16:9`, same list as generators) and a toggle **"Auto Crop"** (off by default).
- Row 2: **tool buttons (left → right):** 
  1. **Crop image** (crop icon; tooltip "Crop Image"); 
  2. **Expand/outpaint** (diagonal arrows; when active the card shows prompt *"Describe what to add around the image…"*, an aspect dropdown (`1:1`) and an **"Auto expand"** toggle); 
  3. **Reframe/camera or folder icon** [UNCLEAR → treat as "Change camera angle"]; 
  4. **Relight** (sun icon); 
  5. **Remove background** (tooltip "Remove background"); 
  6. **Adjust** (sliders icon). 
  7. A **white round pencil button** (far right) = **open in the full Image Editor (B7)**.
- Side panel when **Auto Crop** is on: a small floating panel **"Edit image — Focus Hint (optional)"**: *"Provide hints to guide AI to what to focus on when cropping"* with a textarea (example text: "Extreme close-up, male LAPD officer driver seat, 1970s uniform, aviator sunglasses…"). 
- Run produces **N crops** (badge "⊞ 2", pager) with dimension badges (`725 × 408`, `1344 × 756`).
**Eclipse mapping:** implement **Crop (Auto Crop with focus hint via vision model), Expand, Remove background, Upscale, Relight, Adjust** only where Eclipse already has a model/endpoint; otherwise leave the button out. Credits per tool from the pricing master; local-only tools (plain crop, adjust sliders) can be **free** and run in the browser/canvas [DESIGN].

---

## B7. Full Image Editor (opened from the viewer's brush icon or the node's pencil) [SEEN, video 3]
Large modal titled "Image Editor", image centred, **zoom % bottom-right** (`92%`) and **image size bottom-right** (`1344×768 px`).
**Bottom floating tool bar (left → right):** 
1. **Edit with prompt** (highlighted blue when active): panel *"What do you want to change?"* with sub-tabs **Prompt | Visual**, an **attach-reference** paperclip, a **model dropdown ("Auto")**, and a round **send (↑)** button. 
2. **Brush / paint (inpaint mask)**. 
3. **Crop** (when active: *"Expand your image and describe what you want to change (optional)"*, a **preset dropdown "Custom"**, **width 1344 px × height 768 px** fields, zoom +/- , model "Auto", send). 
4. **Reframe/folder** icon [UNCLEAR]. 
5. **Relight** (tooltip **"Relight  L"**, badge *New*): left panel with a **light-direction preview** (drag the light), **Quick select** presets (Top, Front, Right, Left, Back, Bottom), **Light settings** colour swatches (white, warm, orange, red, blue, cyan…), sliders **Rotation, Elevation, Intensity**, a count control, **Generate**. 
6. **Change camera** (left panel "Change Camera": a **3D orbit preview** with a sphere/ring, sliders **Rotate, Vertical, Zoom**, count, blue **Generate** button). 
7. **Adjust** (left panel with groups **Light, Color, Tone, Grain, Rotate** and a **Presets** grid of 8 thumbnails). 
Close X top-left of the modal.
**Eclipse C3:** the editor is a big sub-project. **Build only:** prompt edit (image + instruction → image model), crop/expand, remove background; treat Relight, Change camera, Adjust presets as **later** unless models exist. Everything runs as normal credit-charged generations.

---

## B8. Variations node (`image-variations`) [SEEN, video 4, and the "Storyboard" part]
**Look:** empty state = centred stacked-frames icon, **"Explore new possibilities"** and caption **"Generate variations from your images."** (own wording in Eclipse).
**Ports:** image input (left, required), text input (left, optional, used by Storyboard/Custom), image output (right) — plus the output is typically wired into a **List** (B9).
**Control row 1:** **Mode dropdown** · **Aspect ratio** (`16:9`, `21:9`) · **Resolution** (`2K`, `4K`) · **Grid** (`1x4`, `2x3`, `3x3`; tooltip **"Grid Size"**).
**Control row 2:** **"N Selected"** (count of variations = rows×cols, e.g. "4 Selected", "9 Selected") · **"Split images"** toggle (on by default, blue) · Run button.
**Modes (dropdown, with small icons) [SEEN]:** **Age · Custom · Demographics · Expressions · Reframe · Storyboard.**
- *Reframe:* new camera angles/framings of the same scene (the demo used 4 frames from one portrait).
- *Expressions:* same person, different expressions. *Age:* same person at different ages. *Demographics:* alternative subjects. [DESIGN: prompts that instruct the image model; see below]
- *Custom:* user types what to vary.
- *Storyboard:* a **prompt box appears: "Describe the storyboard…"** (or a connected Text node supplies the story); output is **a sequence of frames** that tell the story from the input image. Demo: text told a short story and a 3×3 grid (6 shown) of consistent frames came back.
**How it works [DESIGN]:** one image-model call with the source image as reference + a mode-specific system prompt asks for **a single contact-sheet image** laid out `rows×cols`. Eclipse then **splits the sheet into tiles** server-side (equal grid crop, sharp, trim gutters) and stores each tile as its own asset. If **Split images = off**, keep the sheet only. The composite appears in the node (tall `3072×5504`-style image); with Split on, **a List node** is created/updated beside it with the tiles.
**Cost:** one generation at the chosen resolution (the sheet), not N generations. Show the estimate. (This is how the reference product keeps variations cheap; confirm Eclipse's chosen model can output a clean grid, else fall back to N parallel calls and price N×.)
**Node toolbar adds:** split-grid, download, duplicate.

---

## B9. List node (`list`) — complete [SEEN, videos 3–4]
- **Header:** "List #n". Card shows **items as rows (text mode) or as a thumbnail grid (image mode)**.
- **Text mode:** each row = a prompt line (2 lines visible, truncated with …). **Hovering a row shows three icons: edit (pencil), send/open (arrow-up-right), delete (trash)** and a drag handle (⋮) at the right. A **"＋"** button bottom-left adds a row. 
- **Image mode:** grid of 3 thumbnails per row, each with hover actions **expand, send-to-board ("Add to board" tooltip), delete**.
- **Footer bar:** **"＋"**, a dropdown **"Keep Items ▾" / "Replace Items ▾"** (what happens to existing items when a new batch arrives: append vs overwrite), an **items counter ("4 images", "6 images") with a check ✓**, two **view toggles (list / grid)**, and a **target icon** (centre/zoom to item).
- **Ports:** input on the left (image or text), output on the right (image or text, typed by content). 
- **Batch semantics:** List of **prompts → Image Generator** = one image per prompt (the demo ran 5 prompts → 5 images). List of **images** → can feed Video Generator / Upscaler per item. Cost = items × per-item cost; **confirm when > threshold (§17.3)**.
- **Add to board:** pulls one item out as its own Media node ("Creation #n") placed to the right.
- Selecting the List node shows a toolbar (expand, grid view, download all, delete).

---

## B10. Image Upscaler node (`image-upscale`) [SEEN, video 4]
Header "Image Upscaler #n". Image in (left), image out (right). Controls: **`x1` stepper (outputs)**, **mode dropdown "Precision (Clarity)"** (other mode names [UNCLEAR]), **engine dropdown "Magnific V2 (Sublime)"** (Eclipse: its own upscaler model), **scale `2x`**, **style `Balanced`**, gear, Run. Result badge `6080 × 2720`. Output node sits **below/right** of the source with a connecting line. → Map to Eclipse's existing upscaler; expose **scale** and one **strength/"style"** control.

---

## B11. Assistant (LLM) node — corrections [SEEN, videos 1, 5]
- **Model dropdown list (in this reference):** GPT-5 Mini, GPT-5.4, Gemini 3.1 Pro, Gemini 3 Flash, Claude Sonnet 4.6, Claude Opus 4.7. Highlighted row has a check; footer "↑↓ Navigate · ↵ Insert". → **Eclipse list:** `Auto` (default = Sonnet with prompt caching per the pricing master) plus whichever chat models Eclipse already prices. Model names must come from the Eclipse model registry, never hard-coded from this brief.
- **Two icons at top-left of the card = mode switch:** (1) **prompt/chat** (icon like a list box), (2) **sparkle = "improve/enhance"**. Active one has a darker pill background. 
- **Ports:** **left** side has two small round inputs (**text** upper, **image** lower) when connected inputs are allowed; **right** has the text output (T glyph). In video 5 the Assistant card shows a text input handle bottom-left and an output top-right.
- **Output:** the typed/generated text shows in the card; **"Export as text ▾"** dropdown chooses output shape (e.g. text / list). Demo in video 5: a short user line is expanded into a long, professional photography prompt, then fed to an Image Generator.
- Settings gear: system prompt, temperature, max tokens [DESIGN].

---

## B12. Image Generator node — completed [SEEN, videos 2–5]
**Controls row 1:** **`− x1 +`** (outputs per run) · **Model dropdown** (shows e.g. "Google Nano Ban…" truncated, or "Auto") · **Aspect ratio dropdown** (icon + `1:1`, `3:4`, `16:9`). **Row 2:** **Resolution chip `1K / 2K / 4K`** (appears after model supports it) · **gear** (advanced) · **Run**.
**Aspect list (small popup) [SEEN]:** Auto, 1:1, 21:9, 16:9, 9:16, 4:3, 3:4, 4:5, 5:4, 3:2, 2:3, … (scrollable).
**Model dropdown:** searchable list; the first items are **"Auto"** then models grouped by provider. → Eclipse: Auto = cheapest suitable model; list = enabled image models with a credit hint each.
**Prompt flow:** empty node placeholder **"Describe the image you want to generate…"**; connected → "Connected prompt…".
**Result:** full-bleed image + dimension badge; clicking opens the viewer (B5).
**Typical chain in demos:** Text → Image Generator → (Edit image | Upscaler | Variations | Video Generator).
**Parallel chains** on one canvas are normal (a portrait chain and a set/background chain side by side, both later feeding one Video Generator).

---

## B13. Video Generator node — complete [SEEN, video 5]
**Card layout:** big preview area, prompt box bottom ("Describe the video you want to generate…" or "Connected prompt…").
**Left input ports (top → bottom), each a round button with a glyph and a hover tooltip [SEEN]:**
1. **Text** (prompt) 
2. **Image — start image** (first frame; tooltip "Start image" in the settings panel) 
3. **Image — end image** (tooltip **"End image"**) 
4. **Video** (reference video) [glyph = camera] 
5. **Audio** (tooltip **"Audio input"**) 
6. **References** (tooltip **"References"**; bottom, picture-stack glyph; accepts reference images)
**Numeric badge "2"** appears on a port when two sources are connected (e.g. two images as references).
**Right output ports (top → bottom) [SEEN, partly UNCLEAR]:** image (e.g. last/first frame), image/"frames", **video**, **audio** (extract). → Build **video** (required) and optionally **audio**; skip frames.
**Control row 1:** `− x1 +` outputs · **Model dropdown** (shows `Seedance 2.0`) · **Aspect ratio** (`16:9`).
**Control row 2:** **Duration** (`5s`, up to `12s` seen; options depend on model) · **Resolution** (`720p`, `1080p`) · **Sound toggle** (off by default; label "Sound" with its own tooltip) · **gear** (settings panel) · **Run**.
**Settings panel (right side drawer, opened by the gear) [SEEN]:** title "Video Generator", X. Sections: **MODEL** (dropdown), **REFERENCES** (two slots **Start image / End image**, then an **"Add media"** row with small type icons: video, audio, image, character, element…), a **mode dropdown "Manual ▾"** (Manual vs smart/auto) [DESIGN], **Prompt** box with hint *"Reference your video or images using @image 1"*, footer chips **`720` · `5"` · `16:9` · `ON`** (resolution, duration, ratio, sound) and a full-width blue **Run** button.
**`@image 1` references in the prompt:** the prompt can address connected images by number. Implement `@image N`, `@video N`, `@audio N` tokens resolved to the Nth connected input of that type [DESIGN].
**Model picker (popover from the model chip) [SEEN]:**
- Top three rows: **Auto** *(Suggested, with credit range pill e.g. "100–2600" and the line "AI picks what's best for you")*, **Multiple** *("Combine your 4 favorite models" → submenu ›)* — runs the same prompt on several models at once and returns each, **All models** *("Find the best model for you" → opens the big table)*.
- **FEATURED** and **RECENT** groups with credit pills.
- **All-models table (full screen):** filters **All providers ▾ · Features ▾ · All resolutions ▾ · Best for ▾ · Default (sort) ▾ · Search**. Each row: **thumbnail**, **name** (+ "★ Featured" or "New" tag), **capability chips** (e.g. "Realistic videos", "Fast movements", "Illustration & animation", "Motion control", "Lip sync", "References", "Custom seed", "Multi shots"), **input chips** ("Start / End", "Start"), **resolution range chip** (`480p–1080p`, `720p–4K`), **audio chip**, **duration chip** (`4–15"`, `3–15"`), and a **credit range pill** (`559–13.1k`, `210–6000`). 
→ **Eclipse mapping:** build the same table from the model registry: columns Provider, Features, Resolutions, Durations, **credit range computed from pricing master (min–max over supported duration/resolution)**. Models: whatever Eclipse routes (Seedance 2.0/2.5 family, Kling, Veo, Runway etc. per the video-api file). Disabled models do not appear.
**Run feedback:** queue → glowing border → **"Finishing up…"** → result with `1920 × 1080   00:09` badge; click opens the **video viewer** (plays inline, controls, download). Autoplay governed by the setting.
**Demo graph (flagship template #2):** two Text nodes feed two Image Generators (a portrait, an empty set); a third Text node (a long camera-direction prompt) plus both images feed **one Video Generator** (Seedance, 12 s, 1080p) which outputs a walking-towards-camera fashion clip. → Ship as template **"Fashion film (portrait + set → video)"**; text is my own.

---

## B14. Connections — additional details [SEEN, video 2]
- **Drag from an output port:** a **dashed** line follows the cursor with a small **cursor-dot**. On release over a compatible port the line turns **solid**. On release over empty space the **node picker** opens (B3). On release over an incompatible port: the red toast (B1 #2).
- **Existing connection is selectable;** a selected connection shows a **small scissors "cut" marker at its midpoint** (scissors icon on the line) — click it to delete [SEEN at 258 s of video 2]. Also available through the Cut tool (§5.4).
- **Port hit target is larger than its visual** (the port enlarges with a halo ring on hover; the outer halo is white/grey). 
- **Edge routing:** bezier from right of source to left of target, entering the target port horizontally; lines may pass behind other nodes.
- **Multiple outputs:** one output can fan out to several inputs (demo: one text to two generators).
- **Add-to-chain shortcut:** dropping on empty space then picking a node creates it **at the drop position, already connected, and focuses its prompt box**.

---

## B15. Canvas viewport & misc [SEEN]
- **Zoom values seen:** 50% … 200% (labels `109%`, `121%`, `148%`, `200%`, `230%`). Fit-to-view animates. A **zoom-menu list** exists (Part A §7).
- **Canvas is still the same dark dot grid;** nodes never snap to grid unless "Helper lines" shows alignment guides.
- **Text rendering is crisp at every zoom** (HTML nodes in a transformed layer, not a bitmap). React Flow does this.
- **Keyboard:** `N` opens picker, `L` = Connection/cut tool, `Cmd+Z`.  The Relight tool in the editor uses `L` too (tool-scoped shortcuts) [SEEN]. 

---

## B16. New implementation notes for Eclipse

### B16.1 Registry additions
Add node types: `text` (TipTap), `assistant`, `image-gen`, `video-gen`, `image-edit` (B6), `image-variations` (B8), `list` (B9), `image-upscale` (B10), `media` (Upload/Assets), `reference` (C3), and utilities `sticky-note`, `group` (frame; C2). Defer: `speak`, `video-combiner`, `video-upscaler`, `media-extractor`, `designer`, `image-to-svg`, `svg-generator`, `stickers`, `music` unless Eclipse already has the capability (then they are cheap to add as registry entries).
Each registry entry needs: `ports` (typed, with labels/tooltips), `defaults`, `paramsSchema`, `estimateCost`, `run`, `uiComponent`, `pickerMeta {section, description, tags[], new?:boolean, previewGif?}`.

### B16.2 Picker index
Generate picker rows from `registry × enabledModels`. Each `ModelNodeEntry = { nodeType, modelId, label, family, creditRange }`. Search = fuzzy over label+family+provider. Cache client-side.

### B16.3 Variations splitting
Server job: call image model → download sheet → split with `sharp` (`extract` per cell, trim 0–2 px gutters) → upload tiles to R2 → write `Generation` rows (one for the sheet, N for tiles with `parentId`). Return `{ sheetUrl, tileUrls[] }`. Idempotent on `runId`.

### B16.4 List semantics in the executor
`list` node output is an **ordered array**. Executor rule: if a node with a single-value input receives an array, **fan out** (run per item) and collect outputs into a new List (or the node's multi-output pager). Cap fan-out at 20 per run [DESIGN]; always show total cost first.

### B16.5 Model picker data
Single endpoint `GET /api/canvas/models?kind=image|video|chat|audio` returns `{ id, label, provider, features[], resolutions[], durations[], inputs[] (start/end/video/audio/references), creditMin, creditMax, enabled, isNew, isFeatured }` computed from the pricing master + provider capabilities. No hard-coded prices in the UI.

### B16.6 Auto model
`Auto` = server picks a model by task and cost (image: cheapest that supports the requested ratio/resolution; video: default per pricing master). The UI shows the **chosen model name after the run** on the node (small caption) [DESIGN].

### B16.7 Multiple (compare) mode
"Multiple" runs the prompt on 2–4 chosen models and returns outputs as a **multi-output pager** on the same node. Cost = sum; confirm first. C3.

### B16.8 Viewer
One `MediaViewer` component (image/video/grid), used by every node and by comments. Keyboard: Esc close, ←/→ navigate, `+`/`-` zoom, `D` download.

### B16.9 Toasts
Central `toast.error/success` helper; use for incompatible connections, "Added to canvas", cancel notes, insufficient credits.

---

## B17. Extra acceptance tests (add to §15)

1. **Typed ports:** text→image generator **text** port OK; text→**Reference** port rejected with exactly `Incompatible data types / Cannot connect text to image`.
2. **Picker search:** "image" returns Image Editor tools and Image Generator presets; "google"-style provider search returns provider models; category filter with no results shows "Search in all".
3. **Model insert:** choosing a model row creates the node with that model selected and the correct credit estimate.
4. **Run states:** queued → running (timer, stop button) → done (badge with real dimensions); stop releases the unused hold and shows the credits note.
5. **Edit image:** Auto Crop with a focus hint returns 2 crops, pager works, credits charged once per run.
6. **Variations:** 2×2 and 3×3 produce a sheet and N split tiles; Split off keeps only the sheet; cost matches estimate; List shows "Keep/Replace Items" behaviour correctly on re-run.
7. **List fan-out:** 5 prompts → 5 images, total cost confirmed first, partial failure keeps successes and refunds failures only.
8. **Video node:** all six input ports accept only their types; `@image 1` in the prompt resolves to the first connected image; duration/resolution options change with the model; 12 s / 1080p cost estimate equals billed cost.
9. **Multiple/Auto** (C3): Auto shows the chosen model after run; Multiple sums costs.
10. **Viewer:** Esc/arrow keys, download, "Added to canvas" toast, Replace on Media node.
11. **Assets browser:** History shows only the user's own generations; Upload works; nothing from other users is ever listed.
12. **Free-trial user:** can open the picker but only cheap image nodes run; others show the subscribe prompt (no spend).

---

## B18. Updated owner questions (answer once, before C1)
1. Which video models appear in the Canvas model picker at launch? (Default: only those already routed and priced in the pricing master.)
2. Should **Variations** use a single contact-sheet call (cheaper, default) or N separate calls (more consistent, costlier)?
3. Do you want **Multiple (compare models)** in the first release? (Default: no, C3.)
4. Reference library (styles/effects/palettes): skip for now? (Default: yes, only History + Uploads.)
5. Keep **Sticky note** and **Group** in C2? (Default: yes.)


---
---

# PART C — Three more videos: Audio nodes, References → complete workflow, Extract frames
> **Sources:** (7) *Adding audio nodes to a workflow* (341 s), (8) *From references to a complete workflow* (595 s), (9) *Extracting frames from video* (315 s). Method: frames every 3 s, read on screen, plus OCR. **Narration was not transcribed** (speech-to-text too slow on this machine), so anything the presenter only *said* is not here. Tags: [SEEN] = on screen, [UNCLEAR] = visible but not readable, [DESIGN] = my proposal for Eclipse. **Where Part C disagrees with A or B, C wins.**

## C0. What the three videos added (checklist of things A/B did NOT have)
1. **Audio family fully specified:** Voiceover, Sound Effects, Music Generator (C1).
2. **Audio as an input to Video Generator** (lip-sync / soundtrack) and `@Voiceover #1` mentions (C1.5).
3. **Video Combiner** node (C2).
4. **Video Upscaler** node (C3).
5. **Media Extractor / "Extract Frames"** node with 5 modes (C4).
6. **Groups with colours and titles** (C5.1), selection toolbar for multi-select.
7. **Reference workflow pattern:** upload → Assistant writes the prompt from images → generator → profile sheet → reuse via `@name` (C5).
8. **Node naming & `@` mentions by node title**, global numbering (`Image Generator #11`) (C5.2).
9. **Port tooltips** ("Start image", "Generated image", "Combined video", "Audio") (C6).
10. **Run menu:** "This node only (Ctrl+Enter)" and "Run from here"; hover on Run shows the credit cost (C6).
11. **"Creation" nodes** = standalone copy of a generated image/video; **"Add to board"** from a List item (C5.4).
12. **Image viewer toolbar** (expand, info, brush/mark, Edit, download) and the **in-viewer Edit bar** (Original thumb, Save ▾, X) (C5.5).
13. **Multi-output badge** (grid icon + count, top-left of a node) and **numbered port badges** (count of connections) (C6).

---

## C1. Audio nodes [SEEN, video 7 + video 8]
All three audio nodes share one look: a tall card with a **round audio visualiser** (a ring made of a waveform that animates while playing) over a **soft gradient**, the **text that produced it printed at the bottom**, a **play bar** (play, scrub line, volume) and a small round re-run button. The gradient identifies the node type:
- **Music Generator:** multicolour (green, purple, orange). 
- **Voiceover:** purple → pink/peach.
- **Sound Effects:** grey/neutral.
Port colour/icon for audio = **teal circle with a small waveform glyph**. Output port sits top-right of the card (hover tooltip "Audio"). Connection line colour from an audio port = **teal**.

### C1.1 Voiceover (`voiceover`)
- **In:** text (from Text/Assistant) or typed script. **Out:** audio.
- Empty state: prompt box "Describe/enter the text to speak…" with bottom row: `x1 −/+` (batch), **voice picker**, model, run. Result card shows the spoken text at the bottom (e.g. *"I'm obsessed with this. The sound, the design… it just fits my vibe perfectly. I never leave without it."*) and a duration badge top-right (`00:07`).
- **Voice browser** [SEEN, video 7, first minute]: modal listing voices with preview play buttons; models offered in the Audio tab: **ElevenLabs v2, ElevenLabs v3, Gemini (TTS)**. → Eclipse: use its own TTS providers (Seed/Qwen etc.); show a voice list with preview and language; model dropdown with credit hint.
- Cost: per characters/seconds, shown on hover of Run.

### C1.2 Sound Effects (`sfx`)
- Prompt box "Describe the sound effect you want to generate…". Bottom row: `x1 −/+`, **duration dropdown (5", 10", …)**, **Loop toggle** (tooltip "Loop"), run. 
- Example prompt typed: *"relaxing beach ambience, gentle waves, soft wind, distant seagulls, no voices, no music, clean field recording, seamless loop."* Result card grey visualiser with the prompt text and a duration badge.
- Output = audio (tooltip "Audio").

### C1.3 Music Generator (`music`)
- Prompt box (multi-line, long style prompts are normal: BPM, instruments, mood, "no vocals"). Bottom row: `x1 −/+`, **model dropdown** (first shows "Select", options **ElevenLabs Music, Google Lyria 3**), **duration dropdown (30" shown)**, run.
- Result: multicolour card, duration badge `00:31`, play bar.

### C1.4 Shared behaviour
- Prompt text can come from a connected **Text/Assistant** node ("Connected prompt…" faint line, same as image nodes).
- Audio results can be downloaded; double-click opens a small player viewer.
- **Edit/Replace:** none seen.

### C1.5 Audio into Video Generator (lip-sync / soundtrack) [SEEN, video 7 at ~180–260 s]
- Video Generator has a **left audio input port** (teal waveform icon, the 4th/5th port in the stack). Drag from a Voiceover's audio output to it → teal line.
- The prompt references it with a mention chip: **`@Voiceover #1`** (teal chip), image mentions are blue chips (`@Image Generator #2`, `@Branded Render`). Example prompt: *"Use my influencer from @Image Generator #2 in that exact setting, saying what is inside @Voiceover #1. She is casually presenting the speaker @Branded Render in a lifestyle context… synced naturally with her mouth and gestures."*
- Model used: **Seedance 2.0**, `16:9`, **7 s**, **1080p**, **Sound** toggle ON, `x1`.
- Output: video where the person speaks the voiceover (1920×1080, `00:07`). 
- → Eclipse: if the chosen video model supports an audio-reference input (Seedance 2.0 / Omni Human style), pass the audio file URL; if not, **grey out the audio port** with tooltip "This model does not accept audio". Never silently drop the connection.

### C1.6 Audio into Video Combiner
See C2.2. A Sound Effects loop or Music can be laid under a video.

---

## C2. Video Combiner (`video-combine`) [SEEN, videos 7, 8, 9]
**Purpose:** join several clips (and optionally an audio track) into one video.
### C2.1 Anatomy
- Title "Video Combiner #1" with a combine icon. Empty body shows the icon and text **"Connect your videos and run to preview the result"**; once connected and not yet run: **"Run to create the combined video"** and **"Estimated duration: 15s"** (sum of clips).
- **Left input ports (top → bottom):** **video** (accepts many; the port shows a **number badge** = how many clips are connected, e.g. `2`, `5`), and below it **audio** (teal). 
- **Right output ports:** video (tooltip **"Combined video"**), plus image/audio-style ports (frames/audio extract), same pattern as Video Generator.
- **Bottom strip:** thumbnails of the connected clips **in playback order**; the user can **drag to reorder** (seen at 492–498 s: thumbnails with a gap while dragging).
- After run: the combined video plays inside the node with play bar + volume + fullscreen; the strip stays under it; toolbar gains download.
- Run states: "Video combination in queue…" with stop button, then done.
### C2.2 Inputs
- Connect **individual Video Generator outputs** (each connection adds a clip) **or a List of videos** (one connection adds all items in list order).
- Connect an **audio** node (Music / Sound Effects / Voiceover) → plays under the whole combined video. [SEEN video 8, 555–573 s, "Video Combiner #2" = upscaled video + Music Generator]. Estimated duration changed from 15 s to 16 s when the 30 s music was added → the **video length decides the output length**, audio is trimmed to it. [SEEN, inferred]
### C2.3 Eclipse implementation
- Server job with **ffmpeg**: normalise each clip (same fps/size/codec; scale+pad to the largest or first clip), `concat`, optional audio via `-map` (replace) or `amix` (mix with source audio) [DESIGN: default = **replace if clip has no audio, mix at −12 dB for music if it has**; expose later].
- Cost: tiny flat credit or free (compute only). [OWNER DECISION, C8]
- Store result in R2; write a `Generation` row with `kind=video`, `parentIds`.

---

## C3. Video Upscaler (`video-upscale`) [SEEN, video 8, 504–519 s]
- Input: video (green). Output: video.
- Bottom bar: **model dropdown** — options **Magnific Creative, Magnific Precision, Topaz**; a **category dropdown** next to it (e.g. "Animation & 3D"); **FPS Boost toggle**; **settings gear**; Run.
- **Settings panel (opens to the right)** for the Magnific model: header model selector, **Output resolution** (e.g. `2160p (4K)`), **FPS boost** toggle, **Strength** slider (60), **Sharpen** (0), **Smart grain** (0), an info notice (pricing change), and a primary **Run** button.
- Result: output badge e.g. `3840 × 2160  00:02`.
- → Eclipse: only build if a video upscale provider is wired (Higgsfield `upscale_video`, Topaz via provider). Otherwise leave out of the picker. Settings drawer pattern = same as Video Generator's gear.

---

## C4. Media Extractor / "Extract Frames" (`media-extract`) [SEEN, video 9 + video 8 at 444–468 s]
**Picker:** in the VIDEO list as **"Media Extractor"** with a *New* tag. Node title shows **"Extract Frames #1"** with a split-frame icon.
### C4.1 Anatomy
- **One input:** video (green port on the left). Empty state: icon + **"No video connected"** / **"Connect a video to start extracting"**.
- Once a video is connected, the node **shows the video's first frame full-bleed** with a **timeline strip along the bottom** and a **mode dropdown** (bottom-left, default **"Clips"**) and a **Run** button (bottom-right).
- **Output port (top-right)** changes with the mode: **video** (Clips), **image** (frames), **audio** (audio clips).
- Run → "Extraction in queue…" → done. Results feed straight to a **List** node (e.g. "2 videos", "N images").
### C4.2 The five modes (dropdown, each with a one-line description) [SEEN 60–66 s]
| Mode | Description shown | UI on the card | Output |
|---|---|---|---|
| **Clips** | "Extract segments from the source video" | Timeline with **blue range handles**. Drag on the timeline to add a segment; drag edges to trim; **tooltip while dragging: start time + length, e.g. `00:00:03:07 (0.6s)`, `00:00:08:01 (1.5s)`**. Multiple segments allowed (3 shown). Total length label at right (`12.1s`). | **videos** (one per segment) |
| **Extract all frames** | "Extract up to 300 frames in this mode" | No timeline; badge **"≈ 289 Frames"** (top-right) showing how many frames will be made. | **images** |
| **Custom frame rate** | "Choose how many frames per second to extract" | Badge `24 fps ↗` (source rate) top-right; ticks on the timeline show each frame that will be taken; a **slider "Frame rate ● 2 fps"** below changes density live (1 fps = sparse ticks, 21 fps = solid bar, 6 fps = dense). | **images** |
| **Manual selection** | "Pick specific frames from the video" | Frame scrubber **1 … 289**; **click to add a marker** (blue tick); hovering a marker shows **"Frame 145"** with **expand ↗** and **trash** icons; clicking the frame number jumps the preview to it. | **images** (only picked) |
| **Extract audio clips** | "Extract audio clips from the video" | Waveform timeline with **teal handles** (clip start/end), tooltip `00:00:07:07 (3.6s)`; can pick several. | **audio** |
- Videos are **12.1 s / 289 frames at 24 fps** in the demo → cap **300 frames per run**.
### C4.3 After the run
- Connect output to a **List** node (image/video/audio list). List grid view shows the items; hovering an item shows **"Add to board"** (creates a standalone node, see C5.4) plus expand/delete icons; selecting an item shows a **blue check**; footer shows count ("1 image", "2 videos"), view toggles (list/grid) and a settings icon; mode **Keep Items / Replace Items** as in B9.
- Typical use [SEEN]: **extract the last/best frame of a video → feed it as the *Start image* of a new Video Generator** ("he suddenly starts screaming") → a continuous multi-shot sequence; then **Video Combiner** joins the pieces (video 9, 270–300 s).
- Also: **Extract Frames inside the video 8 workflow** to cut a long generated video into 4 clips, then recombine (C5.6).
### C4.4 Eclipse implementation
- Server job (ffmpeg): `-ss/-t` for clips (re-encode to keep exact cuts), `-vf fps=N` or `select` for frames, `-vn -acodec` for audio. Upload each to R2; create `Generation` rows. **Frame count cap 300; clip count cap 12.**
- **Serverless caveat:** ffmpeg does not run well on plain Vercel functions (size/time limits). Use a **small media worker** (Fly.io/Railway/Cloud Run container with ffmpeg, called by the Next.js API with a signed request; results written to R2; status via SSE). Same worker serves **Video Combiner** and Sharp-heavy jobs. [DESIGN, flagged in C8]
- Preview scrubbing in the node is done **client-side** with the `<video>` element (no server call) — only Run hits the server.
- Cost: **free or 0.1 credit flat** [OWNER DECISION]. Free-trial guard: allowed (cheap).

---

## C5. "From references to a complete workflow" — patterns and new pieces [SEEN, video 8]
This video builds one big board (Character → Surfboard → Shaping room → shots → video). The pieces that are new vs A/B:

### C5.1 Groups (`group`) [SEEN, 156–177 s]
- Select several nodes (drag a marquee, or shift/⌘-click) → a **selection toolbar** appears above the selection with: **colour dot ▾**, **duplicate**, **layout/grid**, **lock**, **group**, **delete**, **download/export**, **more (…)**.
- Choosing **Group** wraps them in a **large rounded rectangle** with a **title above it** (e.g. "Character", "Surfboard", "Shaping Room"). The title is editable. 
- **Colour picker** dropdown on the group/selection: navy, brown, green, purple, etc. (rectangles are dark tinted, 8–12 % opacity feel).
- Moving a group moves all its nodes; groups can be nested in the visual sense by layout only (**not** needed in v1). Zoom-out to ~47 % keeps titles readable (title scales with a minimum size).
- Data: `{ type:'group', id, title, color, x, y, w, h, children:[nodeIds] }`; auto-fit to children with 24 px padding; z-order below nodes.

### C5.2 Naming, numbering and `@` mentions [SEEN]
- Every node has a **title** (editable in the header; header rename icon from B2.6). Defaults are **type + global counter** (`Image Generator #11`, `Assistant #10`, `Extract Frames #1`). Uploaded media take the **file name** as title (`Reference Character 01`, `Reference Cabin`, `Profile Sheet`).
- Typing **`@`** in any prompt opens a picker of nodes on the canvas **by title**; the inserted **chip** shows that title (blue for image, teal for audio, violet for text). Example: *"A detailed photo of the girl @Image Generator #2 but wearing a short jean over the swimsuit… @Creation #2"*; *"@Profile Sheet but with the girl from @Image Generator #1"*; *"The girl and the board from @Image Generator #2 … @Image Generator #3 … in the place @Reference Cabin"*.
- **Rule:** an `@mention` of a node that is **not connected** is auto-connected (or the chip shows a warning) [DESIGN: auto-connect with a dashed line, so the graph stays truthful]. When the Assistant writes the prompt itself it uses **`@img1 @img2 @img3`** in the order of its connected images (C5.3).
- Renaming a node must update chips (store ids, render titles).

### C5.3 Assistant with image inputs (extends B11) [SEEN, 27–45 s]
- Connect up to N images to an Assistant: **thumbnails of the connected images appear in a row in the node header**, and the **input port shows a badge `3`** (connection count).
- User types an instruction ("Based on the references, I want a prompt for a blonde girl with long wavy hair…"); the Assistant returns a **ready-made generation prompt** that refers to the images as `@img1 @img2 @img3`. 
- Header has two small mode icons (**write/edit** and **sparkle = improve/assist**). After a run, the card shows the text with **copy** and **send-to-text-node** icons top-right; the run row reads `GPT-5 Mini ▾  ⚙  Export as text ▾  ▶`. A hover tooltip on ▶ shows **"Run for N credits"**.
- Output port (right, text, violet) → connect to Image/Video Generator's text input. Dashed "ghost" line appears while dragging.
- Re-running overwrites; edit the text by hand any time.
- → Eclipse: Auto chat model (cheap) with image inputs; if the picked model has no vision, show the toast "This model can't read images".

### C5.4 "Creation" nodes and "Add to board" [SEEN, 183–200 s, 234–255 s]
- A **Creation #N** node is a **standalone media node** holding one generated image/video. It is made by **List → item → "Add to board"**, or by dragging a result out of a generator (output port tooltip **"Generated image"**). It has the same hover **"Replace"** button as uploads and can be re-used by `@Creation #2`.
- Use: freeze one result so later re-runs of the generator don't change what downstream nodes see.

### C5.5 Image viewer and in-viewer Edit [SEEN, 48 s, 180–186 s, 342–357 s]
- Double-click an image → **overlay viewer** (title bar with node name, X to close). **Top-right icons:** **expand ↗** (fit/zoom), **info (i)** (prompt, model, size), **brush** (mark/paint → "inpaint" tools), **Edit** (opens the editor, tooltip "Edit"), **download**.
- **Edit** opens a bottom bar: **Original** thumbnail (blue border = current), a spinner slot for variants, **Save ▾** (save as new Creation / replace) and **X**. (Matches B6/B7 — build once.)
- Zoom badge `100%` bottom-right of the viewer.

### C5.6 The workflow shape (use as a **template seed**) [SEEN]
1. Upload 3 reference images (character, board, room). 
2. Each reference set → **Assistant** ("write a prompt based on the references") → **Image Generator** → clean master image (e.g. blonde surfer on white; teal longboard on white; shaping room).
3. **Profile Sheet** (character sheet) uploaded/generated and then reused: `@Profile Sheet but with the girl from @Image Generator #1` → a new sheet (1344×768) that keeps identity.
4. Shots: Image Generators mixing `@character @board @place` → hero shots (cabin, close-ups of hands sanding).
5. For each shot → **Assistant** writes a Seedance prompt ("a prompt in English for a video using Seedance 2.0 that shows a girl sanding a surfboard…") → **Video Generator** (Start image = shot; Seedance 2.0, 5 s, 720p, Sound off).
6. Clips → **Extract Frames (Clips)** to trim the best 3 s → **List** → **Video Combiner** (5 clips) → **Video Upscaler (Magnific Precision, 4K)** → **Music Generator (ElevenLabs Music, 30")** → second **Video Combiner** (upscaled video + music) → final render.
→ Ship this as an **official template** "Reference-to-video production" (C3 templates).

### C5.7 Video Generator details newly seen
- Left ports show **tooltips**: **"Start image"** for the first image port; the stack is: text prompt, start image, extra image(s), video, audio, image. Right ports: video, image, image, audio (extract).
- Default state `Auto` model, `16:9`, duration shown as **"5-6″" range** for Auto; manual models show a fixed dropdown (5 s, 7 s, 12 s…). **Resolution** dropdown tooltip "Resolution" (720p/1080p). **Sound** toggle.
- Generating state: full-card gradient glow (teal/blue) with **"Your generation is in queue, it will start soon…"** and a stop button; done → video autoplays muted with `1280 × 720  00:01` badge and a **grid badge with count (`2`)** top-left when several variants exist (x2 batch).
- Model picker hover card (Seedance 1.5 Pro): **credit range pill (180–2640)**, chips **Multi shots · Start / End · Draft–1080p · Audio · 4–12″**, and a looping preview clip. → Eclipse: same card from its own model table (credits range computed from the pricing master; chips = capabilities).

---

## C6. Small interface facts (all [SEEN]) — add to B2/B14/B15
- **Port tooltips:** hovering an output port shows the data kind label right of it: *Generated image, Combined video, Audio, Text, Start image*. Add to the registry: `ports[].label`.
- **Port badges:** a number inside a port = number of incoming connections (`2`, `3`, `5`).
- **Run split-button:** ▶ with a ▾; menu: **"This node only  Ctrl+Enter"** and **"Run from here"**; hover on the main ▶ shows **"Run for N credits"** in tiny text. (Run-all upstream = "Run from here" starting at the selected node; B-part run options stay.)
- **Node toolbar (above selected node)** for video/combiner: play, run-options ▾, **expand**, **save/Add to board**, **download**, **delete**, **more (…)** — same family as image nodes; Extract Frames has just run, options, delete, more.
- **Multi-output badge:** grid icon + number top-left of a media node when it holds several results (x2). 
- **Connection colours:** text violet, image blue, **video green**, **audio teal** [confirms and extends B14]. Dashed grey line = in-progress drag.
- **Navigation:** zoom shown bottom-right (`47% … 300%`), minimap icon beside it; zoom range seen **47%–300%** → set min 10 %, max 400 % (more generous than seen).
- **Queue copy:** images "Image in queue…", "Finishing up…", "Generating image… 10s" (elapsed timer), video "Your generation is in queue, it will start soon…", combiner "Video combination in queue…", extractor "Extraction in queue…". Use these exact states: `queued → running (with elapsed s) → finishing → done | failed`.

---

## C7. Implementation notes for Eclipse (add to B16)
1. **Registry additions:** `voiceover`, `sfx`, `music`, `video-combine`, `video-upscale`, `media-extract`, `creation` (=`media` variant), `group`. Each has `ports` with `kind` (`text|image|video|audio`), `label`, `multi:boolean`.
2. **Type rules:** `video` list → `video-combine` multi input OK; `image` list → generators as multi-reference OK; `audio` → `video-gen` (only if model.supportsAudioIn) and `video-combine`. Reject others with the existing toast.
3. **Mentions:** store `{type:'mention', nodeId}` in the TipTap/contenteditable JSON; at run time resolve to the node's current output (URL) and append to the model's reference array in chip order; text prompt sent with chips replaced by `@imgN`/`@audioN` per provider convention.
4. **Media worker** (ffmpeg) for combine/extract: queue with idempotency key `canvasId:nodeId:runId`; progress by polling `Generation.status`; 10-minute hard cap; max input 200 MB / 5 min.
5. **Credits:** Voiceover/SFX/Music via existing audio pricing (2.5× rule from the pricing master); Video Upscaler per second × resolution tier; Combiner/Extractor flat tiny or free. All appear in `estimateCost` and the confirm dialog for Run-from-here.
6. **Free-trial guard:** audio, video, upscaler, combiner = blocked for trial (only the 2 free images); Extractor allowed.
7. **Lists with hundreds of frames:** virtualise the grid; thumbnails 256 px WebP generated by the worker; **never** load 289 full frames into the page.
8. **Groups:** pure UI (z-index below nodes, `parentId` in React Flow v12 for drag-together); excluded from execution.

## C8. Extra acceptance tests (add to §15 / B17)
1. Voiceover → Video Generator (Seedance 2.0) produces a video; with a model that lacks audio-in, the audio port is disabled with a tooltip.
2. Sound Effects with Loop on produces a loopable file; Loop toggle persists.
3. Music Generator model dropdown shows ≥ 1 enabled model; duration choices respect the model.
4. Video Combiner: 5 clips from a List, reorder by drag, run → one video; estimated duration = sum; adding Music keeps the video length.
5. Extract Frames: Clips (3 segments) → 3 videos; All frames → badge "≈ N frames" and cap at 300; Custom fps slider 1→24 changes tick density live; Manual select adds/removes markers; Audio clips → audio list.
6. Extract → List → "Add to board" creates a Creation node; Creation → Video Generator start image works.
7. Group: select 3 nodes → Group → title + colour; drag moves all; undo restores.
8. `@Image Generator #2` renames follow the node's title change; deleting the referenced node turns the chip red with "Missing node".
9. Run menu: "This node only" runs one node; "Run from here" runs downstream only and asks for confirmation above the credit threshold; hover on ▶ shows cost.
10. Free-trial user clicking an audio/video/upscale node Run gets the existing upgrade prompt (no charge, no call).

## C9. Updated owner questions (adds to B18; answer once before C1)
6. **Where does ffmpeg run?** (Default: a small media worker container; needs your OK to add one service/month.)
7. **Combiner/Extractor price:** free, or 0.1 credit flat? (Default: free for Extractor, 0.1 credit for Combiner.)
8. **Voiceover/Music models at launch:** only what your pricing master already has? Which TTS voices to expose? (Default: Seed/Qwen TTS, one music model if priced, else hide Music.)
9. **Video Upscaler:** include now (Higgsfield `upscale_video`) or later? (Default: later, C3.)
10. **Official template:** ship the "Reference-to-video production" board from C5.6? (Default: yes, in C3.)

## C10. Confidence and gaps (read this)
- **Reliable [SEEN]:** layouts, labels, menu items, mode descriptions, tooltips, queue copy, port colours.
- **Not transcribed:** narration for all three videos; I did not hear any limits, prices or tips the presenter spoke.
- **Skimmed:** ~10 % of video 8 (long waits while generations ran; 3-second sampling may have missed 1–2 s toasts).
- **[UNCLEAR]:** exact icon set of the multi-select toolbar (I listed likely functions), exact right-hand ports on Video Combiner (video + 2 image-like + audio), and the exact meaning of the grid badge on the upscaler output.
- **[DESIGN]:** auto-connect on `@mention`, default price choices, ffmpeg worker, min/max zoom.


---
---

# PART D — Overrides from Mike (these win over A, B and C)

## D1. Reuse first: clone only what Eclipse does not have, and improve what it does
The reference product is a **source of ideas, not a spec to rebuild**. Before writing any Canvas code, CC must:
1. **Audit the Eclipse codebase** and produce a short table: each feature/node/UI piece in Parts A–C → status `EXISTS` / `PARTIAL` / `MISSING`. Look at: existing generators (image, video, audio/TTS, chat/Assistant), model pickers and model tables, history/assets library, uploads (R2), credits ledger and cost estimates, free-trial guard, sharing/permissions, comments, templates, toasts, design tokens, keyboard-shortcut system, any lists/batch features.
2. **EXISTS →** do **not** rebuild. Wrap the existing function/component as a node (the node is a thin shell that calls the same server action, same pricing, same ledger). If the existing logic is weaker than the logic described here (e.g. run states, queueing, cost preview, retries, batch handling, `@` references, idempotency), **upgrade the shared logic** so the normal Eclipse tools benefit too, not just Canvas.
3. **PARTIAL →** extend the existing piece to match, keeping its current behaviour and UI language.
4. **MISSING →** build it per Parts A–C.
5. Where Eclipse already has a better or different way to do something, **keep Eclipse's way** and note the difference. Do not copy the reference product's look, names, copy or icons (already in the header).
6. Output the audit table to Mike (in chat or `docs/canvas-audit.md`) **before** building, with a proposed build order of only the MISSING/PARTIAL rows.

## D2. Mobile AND desktop, equal citizens (replaces §14.8 and the "mobile = view + light edit" default)
Eclipse already works on both; Canvas must too. Design every Canvas screen for both from day one:
- **Layouts:** desktop = left floating toolbar, right-side panels, hover toolbars, right-click menu. Mobile = **bottom-docked toolbar**, node picker and settings as **bottom sheets**, share/comments/feedback as full-screen sheets, home page as a single-column list, no hover dependence (every hover action must have a tap or long-press equivalent).
- **Touch gestures:** one finger on empty canvas = pan, two fingers = pinch zoom, tap node = select (shows its action bar), **drag from the node header/handle** = move node (so touch panning is never blocked), **drag from a port** = connect, **tap port then tap target** also connects (easier on small screens), long-press = context menu (replaces right-click), tap empty space = deselect.
- **Selection and multi-select on touch:** a "Select" mode toggle in the toolbar for marquee selection and group; group/delete actions in the bottom bar.
- **Editing:** prompts, Text node, Assistant, voiceover scripts, Extract Frames timeline handles, sliders and the frame scrubber must be **touch-sized (min 44 px targets)**; the on-screen keyboard must not cover the field (scroll into view, `visualViewport` aware).
- **Performance on phones:** virtualise node rendering outside the viewport, lazy-load media, thumbnails only (WebP), cap concurrent video previews to 1, pause off-screen videos, throttle minimap, avoid heavy blur/shadows on mobile.
- **Safari/iOS specifics:** iPhone Safari is a primary target. Test pinch-zoom not zooming the page (`touch-action`, viewport meta), no 100vh bug (use `dvh`), file uploads from Photos/Files, audio/video autoplay rules (play only after tap), and safe-area insets.
- **Same data and same features on both:** no "desktop only" node or action. If something is genuinely awkward on a phone (e.g. dragging 300 frames), provide a simpler mobile path (list view + checkboxes) rather than hiding it.
- **Acceptance (add to §15):** each phase must pass its tests on **iPhone Safari (small), iPad Safari, desktop Chrome and Safari**. Required mobile tests: create canvas, add 3 nodes via bottom sheet, connect two by tap-tap, run a node, edit prompt with keyboard open, pinch/pan without page zoom, share link, undo/redo, Extract Frames manual pick, Video Combiner reorder by long-press drag.

## D3. Phase order with the above
C1 = audit (D1) + core canvas on **both** form factors + only the node types that are MISSING or PARTIAL; C2+ as in §1, each phase shipped on both form factors. Remove "mobile = view + light edit" from §17 owner decisions; it is no longer a question.
