// Slash commands for Atlas: typing "/" in his chat field lists them; sending "/voicelock ..." loads that skill for the reply.
// Browser-safe (no server imports): the menu reads the list, agent-turn.ts reads `commandOf` and forces the skill.
export type AtlasCommand = { id: string; label: string; hint: string; force: string; start: string };

export const ATLAS_COMMANDS: AtlasCommand[] = [
  { id: "voicelock", label: "Voice lock", hint: "One consistent voice for a character across shots", force: "voiceLock", start: "Character Voice Lock: begin with Step 0 and ask only what is missing." },
  { id: "seedance", label: "Seedance director", hint: "Storyboards and Seedance 2.5 prompts", force: "director", start: "Seedance director: start the intake." },
  { id: "fashion", label: "Fashion campaign", hint: "Concept, styling and hero prompts for a campaign", force: "fashion", start: "Fashion Campaign Director: build the campaign from what I give you." },
  { id: "ugc", label: "UGC ads", hint: "Creator-style ads, hooks and a test plan", force: "ugc", start: "UGC ad craft: start with the six answers you need." },
  { id: "productvideo", label: "Product video", hint: "A creator-style product video, one Seedance prompt", force: "productVideo", start: "Product Video Craft: start the steps." },
  { id: "addmotion", label: "Add motion", hint: "Bring a still picture to life", force: "addMotion", start: "Add Motion Craft: help me animate my picture." },
  { id: "ads", label: "Ad copy", hint: "Headlines, hooks and ad visuals", force: "ads", start: "Ad Creative Director: help me with my ad." },
  { id: "cinema", label: "Cinema craft", hint: "Lens, camera, light and shot types", force: "cinema", start: "Cinema Craft: help me shape the look and camera." },
  { id: "director", label: "Fix my video", hint: "Why a video drifts, morphs or looks fake", force: "directorCraft", start: "Director Craft: help me find what is wrong and the cheapest fix." },
  { id: "shortform", label: "Short-form", hint: "Hooks, structure and pacing for short videos", force: "shortForm", start: "Short-form craft: help me write and structure it." },
  { id: "screenplay", label: "Screenplay", hint: "Scenes, dialogue and story", force: "screenCraft", start: "Screenwriting craft: help me with the story." },
  { id: "brainstorm", label: "Brainstorm", hint: "Shape a rough idea with questions", force: "brainstorm", start: "Brainstorm craft: ask me one open question at a time." },
  { id: "production", label: "Production pack", hint: "Logline, shot list, budget and schedule", force: "production", start: "Production pack craft: build a pack from my idea." },
  { id: "motion", label: "Motion film", hint: "Launch films, explainers and motion graphics", force: "motionCraft", start: "Motion film craft: help me plan it." },
  { id: "template", label: "Video to template", hint: "Turn a reference video's style into a template", force: "styleTemplate", start: "Reference video to template: start with my reference." },
  { id: "documentary", label: "Documentary", hint: "Interviews, b-roll and archival", force: "documentary", start: "Documentary craft: help me plan it." },
  { id: "marketing", label: "Marketing copy", hint: "Landing pages, captions and launches", force: "marketing", start: "Marketing copy craft: help me write it." },
  { id: "creator", label: "Creator channel", hint: "Grow a channel or sell digital products", force: "creator", start: "Creator channel craft: help me plan it." },
  { id: "performance", label: "Performance", hint: "Believable people: gesture, gaze, timing, listening", force: "performance", start: "Performance Craft: build the characters and write the performance directions." },
  { id: "scene", label: "Scene director", hint: "Break a picture or idea into shots", force: "scene", start: "Scene Director: break it into shots." },
];

/** The command a message starts with ("/voicelock make my knight speak"), if any. */
export function commandOf(text: string): AtlasCommand | null {
  const m = /^\s*\/([a-z]+)\b/i.exec(text);
  return m ? ATLAS_COMMANDS.find((c) => c.id === m[1].toLowerCase()) ?? null : null;
}
/** Commands whose name starts with what is typed after the slash. */
export function matchCommands(typed: string): AtlasCommand[] {
  const m = /^\/([a-z]*)$/i.exec(typed.trimStart());
  if (!m) return [];
  const q = m[1].toLowerCase();
  return ATLAS_COMMANDS.filter((c) => c.id.startsWith(q) || c.label.toLowerCase().includes(q));
}
