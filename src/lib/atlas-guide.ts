// Atlas's product knowledge: what every screen, chip and model in Eclipse is and how to use it, so he can explain and teach a beginner.
// Two parts: SCREEN_GUIDES (hand-written, one per screen; the current screen's guide rides in the system prompt) and the `explain` tool, which looks up a
// model or a feature on demand. Model FACTS (ratios, lengths, qualities, sound, references, limits) are read from the real registries so they never drift;
// the hand-written notes below add only strengths, best use and cautions that are already established in this repository's own docs.
import type Anthropic from "@anthropic-ai/sdk";
import { VIDEO_MODELS, capsFor, type VideoModel } from "@/lib/video-models";
import { enabledModels, type ImageModel } from "@/lib/models";
import { AUDIO_MODELS, PROVIDER_LABEL, type AudioModel } from "@/lib/audio/registry";
import { MODELS_3D, type Model3DSpec } from "@/lib/design/models3d";

export const TEACHING_NOTE = `TEACHING: you also know Eclipse inside out. When the person asks what a chip, setting, model or screen is, or seems new, explain it simply, in plain words, with one practical tip, and offer to set it for them. For anything about a specific model or feature, call explain_eclipse first so your answer uses Eclipse's real numbers (never guess lengths, ratios, limits or what a model can take). Start with what it is for, then how to use it, then its limits. Short answers for quick questions; a gentle walk-through when they are a beginner. Never mention prices from memory: the price shows on the Generate button.\n\nAUTOMATION: you can do the work FOR the person, not only advise. On any screen you can set their prompt box and offer buttons (Generate, Make this picture or clip). With the Scale plan you can also run a MISSION: a goal you work on by yourself on the server (planning, making pictures, video, voiceover, music, sound effects and 3D models, looking at the results and fixing them, even with the app closed), asking approval for what costs credits (or working inside a budget they set) and always asking before anything is sent out to an app. When a person describes a repeated or multi-step job (a campaign, a series, a batch of variants), offer to run it as a mission, explain simply what you will do and roughly what it costs, and let them approve. If they are not on Scale, say plainly that missions are a Scale feature and still help step by step.`;

const IMAGE = `IMAGE STUDIO (make pictures). The prompt box holds: the + (upload a picture from the device to Assets; it becomes an ingredient when the model takes pictures); aspect ratio chip (Auto follows the first reference picture's shape; otherwise pick a shape); count (1 to 4 pictures per run, each its own request); quality (1K, 1.5K, 2K, 4K, greyed where a model cannot make it; higher costs more); model picker (Auto picks a fitting tested model per picture; Popular and All models by maker; models that are Soon are not connected); Ingredients (pictures from Assets, Ingredients or My images that guide the result, numbered "image 1, image 2" in the order added: refer to them that way in the prompt); Open canvas (starts a canvas with the prompt wired into a generator); Atlas chip and switch; Fixed seed (only models that support it: the same seed gives similar, never identical, results; with several pictures the seed counts up by one); Soul ID chip (only on Soul models: use a trained character). The tool tray under a finished picture: Edit (change it with words or pins), Variations (a grid of alternatives: four modes), Upscale (sharper and bigger), Remove background, Relight (six looks), Change camera (new angle), each makes a NEW picture and keeps the original. Details ("i" button) show file facts, seed and the prompt; Re-run with this seed and New variation live there. Finished pictures go to the project's Gallery and the Library.`;

const VIDEO = `VIDEO STUDIO (make video). The prompt box holds: + (adds a picture as an ingredient on models that take references, else as the start frame); sound switch; aspect ratio (hidden when the model follows the start picture's shape); length; quality (resolution); model picker (Popular and All models; a model that cannot do something is greyed, never hidden); Start frame and End frame (the first and last picture of the clip; the shape follows the start picture); Ingredients (reference pictures, My videos for reference clips, My audio for reference sounds, numbered image 1, video 1 in the order added: use those names in the prompt); Motion chip (Motion + subject: copy the movement of a clip onto a person from a picture; engines Kling, Genjutsu, Eclone (changes what is in a video and keeps its performance); and ShotMap, a 3D camera planner that makes a guide clip); Atlas chip and switch; settings gear (Fixed seed, Leave out / negative prompt, Prompt strength, Multi-shot on Kling 3.0 up to 6 shots; each shown only if the model has it). The tool tray: Relight, Editor (a timeline to cut, join, add titles and sound, exported on the device), Upscale (1080p or 4K). A finished clip's details offer Edit video and Add sound. Videos take minutes: they keep making if the person leaves, and finished ones land in the Gallery and Library.`;

const VOICE = `AUDIO STUDIO (make sound). Four modes: Speak (turn a script into a voice), Transcribe (speech to text with times and speakers; record or upload; subtitles .srt), Effects (describe a sound effect; length 0.5 to 30 s or Auto; some models make several variants), Music (describe a track; length and Instrumental). Speak has a voice strip (pick a voice, All opens search; New makes your own: Clone from a short clean recording with a consent box, or Design from a description), a model chip (each model has its own voices, language reach and tags), speed (greyed where a model has none), and Delivery tags (like [whispers] or (laughs): only the models that read them, written the way that model reads them). Text over a model's limit is refused with a count shown at the limit. Takes list below with play, Download, Delete (to the Bin) and the Certificate medal. VOICE LOCK: when the person wants one consistent voice for a character across Seedance shots, run the Character Voice Lock method here: write the voice brief, help them make a clean 10 to 15 s reference take in Speak (suggest_prompt fills the script, they press Generate), then tell them to save the take in Assets as a sound (like KNIGHT_voice_v1) and add it in Video Studio's Ingredients (My audio).`;

const DESIGN3D = `DESIGN STUDIO, 3D TAB (you are here). Make a 3D model (.glb) from one picture, several views of the object (front, back, left, right) or words: choose How to start, a Model, Colour and texture, and More (extra detail, realistic materials, rig for animation on models that support it, the detail slider); the model shows on a turntable and can be renamed, downloaded, or added to ShotMap. The Motion tab (next to it) makes animated graphics.`;
const DESIGN = `DESIGN STUDIO (3D and motion). The 3D tab makes a 3D model (.glb) from one picture, several views of the object (front, back, left, right), or words: choose How to start, a Model, Colour and texture, and More (extra detail, realistic materials, rig for animation on models that support it, the detail slider); the model shows on a turntable and can be renamed, downloaded or added to ShotMap. The Motion tab makes a motion graphic from words and pictures: aspect ratio, length (5 to 60 s or Auto), loop, sound parts (effects, music, voiceover; each quoted and approved first), a Brand kit (colours, fonts, logos), Templates, Ask first or Auto approve; open one to comment on a moment, ask for changes, compare versions, Remix, and Download as MP4 (1080p or 4K).`;

const CORE = `CORE (the creative computer). A chat that can make pictures, run Skills (ready playbooks), use Memory, and queue sends to connected apps. Chips: Skills, Tools (for example the Video editor and Kinetic films), Memory, Connectors (Telegram, Slack and others that connect with a pasted key; some apps are coming). The model chip picks Eclipse Lite, Pro or Max (bigger is smarter and costs more credits per reply). The + attaches pictures or documents; the mic dictates; each reply can be read aloud. Core never sends anything by itself: it queues a card and the person presses Send.`;

const TREATMENT = `TREATMENT (plan a video before making it). Brief, Concept and Guide tabs. Brief pulls goals, audience and gaps from what the person gives (text, Word, PDF, links, pictures). Concept shapes and challenges an idea. Guide asks one question at a time. The plan card (title, idea, audience, goal, tone, look, structure, notes) fills as they talk; Continue to prompts hands it to Prompts.`;

const CANVAS = `CANVAS (a node board). Nodes give and receive typed things (prompts, characters, products, scenes, styles, pictures, clips, sounds) along wires; a generator only receives what is wired into its ports. Node kinds include Text prompt, Character, Product, Scene, Style, Image generator, Full-body generator, Video generator, Character sheet, Image, Video, Assistant, Voiceover, Sound effects, Music, Image editor, Upscaler, Variations, 3D model, List (runs a generator once per line), Group and Note. Tools: pan and select modes, undo, templates, share link, comments, settings.`;

const MOTION = `DESIGN STUDIO, MOTION TAB (you are here). Motion makes an animated graphic (titles, explainers, product intros, social loops, charts, logo stings) that the agent writes as drawing code and plays live; nothing is a video model, so it is exact, editable and sharp at any size. HOW IT WORKS: the person describes it in the prompt box; the agent writes a motion, plays it in the preview, and every change makes a new version (versions can be compared). BOX CONTROLS: the mic dictates; the settings popup holds Permissions (Ask first = sound parts are quoted and wait for approval; Auto approve = they start at once) and Defaults (which picture model, clip model, voice model and voice Atlas and the motion use when they make assets); aspect ratio (16:9, 9:16, 1:1, 4:5, 4:3, 21:9: choose it for where it will be shown); length (5 to 60 s, or Auto lets the agent decide); loop (makes the end join the start for social loops); Audio popup (sound effects, music, voiceover: each is a real Audio Studio job, quoted first); Brand kit (colours, fonts, logos and notes it must use, made by hand or from a website, text or an existing motion); + (pictures that appear as @1, @2 in the prompt); Ingredients (pictures and the person's own finished video clips, V1, V2, up to 4 clips, each played inside the motion); Templates (a popup of starting looks with previews); Atlas chip. TIPS: name exact words, numbers and chart values; say the order of beats and rough timing; say the mood in a few words (calm, punchy, luxurious) and what to avoid; use a brand kit so colours and fonts stay consistent; give pictures a job ("@1 is the product, centre it at the end"). AFTER IT PLAYS: scrub the timeline, drop a comment pinned to a moment and spot ("make this line bigger here"), then ask for a change; suggestion chips offer common next edits; Remix recreates it, adapts it to other aspect ratios, or turns it into a brand kit; compare versions side by side. Download makes an MP4 on the device (1080p or 4K, 24, 30 or 60 fps, optional motion blur) and also saves it to the Library. YOU CAN: set the box for them, suggest a stronger prompt, and make a background picture or short clip for the motion with the Make button (they press it). LIMITS: it draws shapes, text, pictures and clips; it does not generate realistic footage, people or 3D scenes (use Video Studio or ShotMap for that, then bring the clip in); sound parts cost credits, are quoted first, and need an Audio plan access.`;

const PROMPTS_PAGE = `PROMPTS (a prompt engineer). Tabs for AI Master Engine (image prompts, JSON prompting), Kling 4 UGC and Seedance 2.5 (video prompts). Each answer's prompts come in their own copyable block, with buttons to use them in Image Studio or Video Studio.`;

/** The guide for the screen Atlas is on; Design Studio's two tabs get their own (the host says which tab in its settings lines). */
export function guideFor(page: unknown, settings: unknown): string | null {
  if (typeof page !== "string") return null;
  if (page === "design") { const tab = Array.isArray(settings) ? settings.map(String).find((l) => l.startsWith("Tab:")) ?? "" : ""; return /Motion/.test(tab) ? MOTION : DESIGN3D; }
  return SCREEN_GUIDES[page] ?? null;
}

const SHOTMAP = `SHOTMAP (you are here). ShotMap is a 3D camera planner: build a rough set (Compose), look through the camera (Shoot), and direct the camera in Motion, then Use video makes a guide clip that Seedance 2.5 follows. Motion has two options: Keyframes (a timeline: add keyframes where the camera should be, ease between them, cut shots) and Moves (pick a camera move and set sliders; the camera runs it for you, no keyframes). Moves: Dolly in/out, Truck left/right, Crane up/down/left/right, Orbit 180/360, Pan left/right, Tilt up/down, Hero low/high, Look (shin height, handheld, follow); stack a second move at the same time or one after the other; sliders Rotate, Vertical, Distance, Speed, Lens, Length and Handheld shake. YOUR HELPER: ShotMap has a scene assistant that is yours. When the user wants something the Moves settings cannot say (add, move or remove things in the set, or a camera path as keyframes), call set_prompt_box with scene_request (and scene_mode: scene for the set, motion for keyframes); it runs when they press Apply. YOU CAN set the Moves for the user from a described camera motion (set_prompt_box with the camera fields): pick the closest move, add a second one when it fits, and set distance and lens to suit the subject. YOU CAN SEE THE SET: every message in ShotMap comes with a written outline of every item (where it stands, how it is turned, its size) and where the camera is, and a snapshot picture of the 3D view (it shows the grid and camera markers; people are simple mannequins and some objects are plain shapes, while others are real models with their own colours). Use them. Never say you cannot see the set or that nothing is attached; read the positions, say what is where, and aim the camera at the real subjects (the person, the vehicle, the model) instead of an imagined one. YOU CAN WATCH THE MOTION: when the camera moves, the message also carries a filmstrip of 8 frames of the shot camera's own view from the first second to the last, each labelled with its time. Watch them like a director: what each stage reveals, framing, whether the subject stays in view, how it starts and finishes. Say what works and what does not, then revise: set new moves, or send keyframes through scene_request (scene_mode motion), and tell the user what you changed and why. Never say you can only see a still. If the outline says the scene is empty, say so and offer to build it with scene_request.`;

export const SCREEN_GUIDES: Record<string, string> = {
  shotmap: SHOTMAP,
  create: IMAGE, canvas: CANVAS, video: VIDEO, generate: VIDEO, voice: VOICE, design: DESIGN, core: CORE, treatment: TREATMENT, prompts: PROMPTS_PAGE,
};

// Established strengths, best use and cautions per model (only facts already in this repo's docs). Facts such as lengths and ratios come from the registry instead.
const NOTES: Record<string, string> = {
  seedance_2_5: "Strengths: the longest clips here (4 to 30 s), native sound (music, effects, speech), text, start-frame and reference modes in one model, up to 30 reference pictures plus 10 clips and 10 sounds, plus Edit and Extend on a finished clip and a cheap 480p Draft to preview first. Best use: give one clear subject, one camera move and a sequence in time order (whole-second timestamps work well); reference pictures are named image 1, image 2 by the order added; keep shots short and specific. Limits: no seed, negative prompt or prompt-strength control; with a start frame or an Edit/Extend job the shape and look follow the source; no 4K; its safety filter often refuses pictures of realistic real people; one change at a time when retrying works best.",
  seedance_2_0: "Strengths: sound, start and end frames, reference pictures (up to 9) and clips (up to 3), 4K output, Edit and Extend on clips up to 15 s. Limits: 4 to 15 s clips, no seed or negative prompt; the same privacy filter on realistic people.",
  kling_3_pro: "Strengths: dependable image-to-video, sound on or off, start and end frames, Multi-shot (up to 6 shots, each with its own prompt and 1 to 15 s), 3 to 15 s clips. Best use: a clear start picture and a short action; use Multi-shot for a sequence with cuts.",
  kling_3_std: "The lighter, cheaper Kling 3.0 tier: same controls as Pro (sound, end frame, Multi-shot) at a lower cost and less polish.",
  kling_4_0: "Kling 4.0: 3 to 30 s clips in 720p or 1080p, text or start frame with an optional end frame, no sound control. Best use: longer single shots from a strong start picture.",
  soul_v2: "Soul 2: the fast, low-cost everyday picture model; supports a fixed seed and a trained Soul ID for a consistent character. Best use: portraits, fashion and lifestyle looks and quick drafts.",
  nano_banana_pro: "Nano Banana Pro: strong at following detailed prompts, text in pictures and editing from reference pictures; also the model Eclipse's picture tools prefer. Takes JSON prompts of up to 8,000 characters.",
  gpt_image_2_5_sunburst: "GPT Image 2.5: good at readable text, layouts and instruction following, and edits from references; Eclipse's safety filter checks pictures of real people strictly.",
  seedream_5_pro: "Seedream 5 Pro: strong photoreal and design images in 2K and up with up to 10 reference pictures; prompts are best kept under about 3,000 characters.",
};

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");
const list = (a: string[]) => a.join(", ");

function videoFacts(m: VideoModel): string {
  const live = m.live;
  const wf = (["t2v", "i2v", "ref"] as const).filter((w) => live?.endpoints[w]);
  const caps = capsFor(m, "t2v");
  const lens = live ? `${live.durations.t2v.min} to ${live.durations.t2v.max} s${live.durations.t2v.values ? ` (only ${list(live.durations.t2v.values.map(String))})` : ""}` : `${m.durations[0]} to ${m.durations[m.durations.length - 1]} s`;
  const bits = [
    `${m.label} (video, by ${m.maker}). ${m.blurb}${live ? "" : " Not connected yet (Soon)."}`,
    `Modes: ${list(wf.map((w) => (w === "t2v" ? "text to video" : w === "i2v" ? "start-frame to video" : "reference to video")))}.`,
    `Clip length ${lens}. ${m.qualities.length ? `Quality: ${list(m.qualities)}.` : "One fixed quality."} Aspect ratios: ${live?.aspect ? list(live.aspect.values) : list(m.ratios)}.`,
    `Sound: ${m.sound === "toggle" ? "can be switched on or off" : "none"}. Start frame: ${m.startFrame ? "yes" : "no"}. End frame: ${m.endFrame ? "yes" : "no"}.`,
    live?.refs ? `References: up to ${live.refs.max} pictures${live.refs.videos ? `, ${live.refs.videos.max} clips` : ""}${live.refs.audio ? `, ${live.refs.audio.max} sounds` : ""}.` : "",
    `Seed: ${caps.seed ? "yes" : "no"}. Negative prompt: ${live?.negativePrompt ? "yes" : "no"}.${live?.multiShot ? ` Multi-shot up to ${live.multiShot.max} shots.` : ""}`,
    m.draftOf ? "This is a quick 480p preview; the final 1080p video is made from it later." : "",
    live?.note ?? "",
  ];
  return bits.filter(Boolean).join(" ");
}

function imageFacts(m: ImageModel): string {
  return [
    `${m.label} (image). ${m.blurb}`,
    `Aspect ratios: ${list(m.ratios)}.`,
    m.resolutions.length ? `Quality tiers: ${list(m.resolutions)}.` : "No quality choice.",
    `References: ${m.references.max ? `up to ${m.references.max} pictures${m.references.min ? ` (needs at least ${m.references.min}, an editing model)` : ""}` : "none"}. Seed: ${m.seed.supported ? "yes" : "no"}.`,
  ].join(" ");
}

function audioFacts(m: AudioModel): string {
  const kinds = m.kinds.map((k) => (k === "tts" ? "speech" : k === "stt" ? "transcription" : k === "sfx" ? "sound effects" : k === "music" ? "music" : k));
  return [
    `${m.label} (audio, ${PROVIDER_LABEL[m.provider] ?? m.provider}). Makes: ${list(kinds)}.`,
    `Up to ${m.maxChars.toLocaleString()} characters per take. Delivery tags: ${m.supports.emotionTags && m.tags?.length ? `yes, ${list(m.tags.slice(0, 8))}` : "no"}. Speed: ${m.supports.speed ? "yes" : "no"}. Voice cloning: ${m.supports.voiceClone ? "yes" : "no"}.`,
    m.note ?? "",
  ].filter(Boolean).join(" ");
}

function model3dFacts(m: Model3DSpec): string {
  return `${m.label} (3D, by ${m.maker}). ${m.blurb}. Starts from: ${list(m.modes.map((x) => (x === "image" ? "one picture" : x === "multi" ? `${m.minImages} to ${m.maxImages} views` : "words")))}.${m.rig ? " Can rig the model for animation." : ""}`;
}

export function findModels(query: string): string[] {
  const q = norm(query);
  if (!q) return [];
  const out: { score: number; text: string }[] = [];
  const hit = (id: string, label: string) => (norm(id) === q || norm(label) === q ? 3 : norm(label).includes(q) || norm(id).includes(q) ? 2 : q.includes(norm(label)) && norm(label).length > 3 ? 1 : 0);
  for (const m of VIDEO_MODELS) { const s = hit(m.id, m.label); if (s && !m.hidden) out.push({ score: s, text: `${videoFacts(m)}${NOTES[m.id] ? `\n${NOTES[m.id]}` : ""}` }); }
  for (const m of enabledModels()) { const s = hit(m.id, m.label); if (s) out.push({ score: s, text: `${imageFacts(m)}${NOTES[m.id] ? `\n${NOTES[m.id]}` : ""}` }); }
  for (const m of AUDIO_MODELS) { const s = hit(m.id, m.label); if (s) out.push({ score: s, text: audioFacts(m) }); }
  for (const m of MODELS_3D) { const s = hit(m.id, m.label); if (s && !m.off) out.push({ score: s, text: model3dFacts(m) }); }
  return out.sort((a, b) => b.score - a.score).slice(0, 3).map((x) => x.text);
}

export function featureGuide(topic: string): string | null {
  const t = norm(topic);
  const map: [string[], string][] = [
    [["image", "imagestudio", "create"], IMAGE], [["video", "videostudio", "generate", "shotmap", "motion", "eclone", "editor"], VIDEO],
    [["audio", "voice", "audiostudio", "speak", "transcribe", "effects", "music"], VOICE], [["design", "3d", "designstudio"], DESIGN], [["motiongraphic", "motiongraphics", "motiontab", "brandkit", "remix"], MOTION],
    [["core", "skills", "tools", "memory", "connectors"], CORE], [["treatment", "brief", "concept"], TREATMENT], [["canvas", "node", "nodes"], CANVAS], [["prompts", "promptengineer"], PROMPTS_PAGE],
  ];
  const found = map.find(([keys]) => keys.some((k) => t === k || t.includes(k)));
  return found ? found[1] : null;
}

export const GUIDE_TOOL: Anthropic.Tool = {
  name: "explain_eclipse",
  description: "Look up how something in Eclipse works so you can explain or teach it accurately: a model (for example Seedance 2.5, Kling 3.0, Nano Banana Pro, Eleven v4, Hyper3D) returns its real capabilities, limits, best use and cautions; a screen or feature (Image Studio, Video Studio, Audio Studio, Design Studio, Core, Treatment, Canvas, Prompts, a chip such as Motion, ShotMap, Ingredients, Fixed seed) returns what it is and how to use it. Call it before answering any 'what is' or 'how do I' question about a model or feature. Free; makes nothing.",
  input_schema: { type: "object", properties: { topic: { type: "string", description: "The model name, screen or feature to look up." } }, required: ["topic"] },
};

export const isGuideTool = (n: string) => n === "explain_eclipse";

export function runGuideTool(input: Record<string, unknown>): { content: string; isError?: boolean } {
  const topic = typeof input.topic === "string" ? input.topic.trim().slice(0, 80) : "";
  if (!topic) return { content: "Give a model, screen or feature name.", isError: true };
  const models = findModels(topic);
  const guide = featureGuide(topic);
  const parts = [...models, ...(guide ? [guide] : [])];
  if (!parts.length) return { content: `No match for "${topic}". Try a model name (for example Seedance 2.5) or a screen (Image Studio, Video Studio, Audio Studio, Design Studio, Core, Canvas).`, isError: true };
  return { content: parts.join("\n\n") };
}
