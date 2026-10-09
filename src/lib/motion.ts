// Motion graphics: a browsable library of motion prompts (the prompt behind each clip, the model, how many tries it took).
// The layout is adapted from the user's Prompt Motion reference; the entries here are Eclipse's own placeholder prompts
// with no pictures or video yet, so every card is an empty tile. Wording is our own; nothing is copied from another site.
export type MotionTag = "Product UI" | "Phone" | "Charts" | "Diagrams" | "Kinetic type" | "Shapes" | "Particles" | "Characters" | "Photos" | "Music";
export const MOTION_TAGS: MotionTag[] = ["Product UI", "Phone", "Charts", "Diagrams", "Kinetic type", "Shapes", "Particles", "Characters", "Photos", "Music"];

export type MotionPrompt = { id: string; title: string; tags: MotionTag[]; prompt: string; model: string; tries: string; ratio: "16 / 9" | "9 / 16" | "1 / 1" | "4 / 5" };

export const motionPrompts: MotionPrompt[] = [
  { id: "launch", title: "App launch reveal", tags: ["Product UI", "Phone"], ratio: "9 / 16", model: "Sample", tries: "One try", prompt: "A phone floats up from the dark, the screen lights, and three app panels slide out around it in sequence. Slow camera push, soft red rim light, clean background." },
  { id: "growth", title: "Growth chart that draws itself", tags: ["Charts"], ratio: "16 / 9", model: "Sample", tries: "Two tries", prompt: "A line chart draws itself left to right over a dark grid, the line glows red, numbers count up at each point, and the final value pulses once." },
  { id: "flow", title: "Diagram that explains itself", tags: ["Diagrams"], ratio: "16 / 9", model: "Sample", tries: "Three tries", prompt: "Boxes and arrows assemble a simple flow diagram one step at a time, each step labelled as it appears, ending with the whole diagram zooming out." },
  { id: "type", title: "Kinetic type opener", tags: ["Kinetic type"], ratio: "1 / 1", model: "Sample", tries: "One try", prompt: "Bold white words slam onto a black screen in time with a beat, each one scaling and cutting to the next, the last word held in red." },
  { id: "shapes", title: "Shapes in rhythm", tags: ["Shapes", "Music"], ratio: "4 / 5", model: "Sample", tries: "Two tries", prompt: "Circles, squares and lines move in a loop that follows a steady drum pattern, snapping together into a logo shape on the last beat." },
  { id: "particles", title: "Particle burst", tags: ["Particles"], ratio: "16 / 9", model: "Sample", tries: "One try", prompt: "A swarm of small red particles drifts, gathers into a sphere, then bursts outward in slow motion against a charcoal background." },
  { id: "character", title: "Character walk cycle", tags: ["Characters"], ratio: "9 / 16", model: "Sample", tries: "Four tries", prompt: "A simple flat character walks across the frame in a seamless loop, with a small bounce on each step and a soft shadow underneath." },
  { id: "photos", title: "Photo collage in motion", tags: ["Photos"], ratio: "4 / 5", model: "Sample", tries: "Two tries", prompt: "A stack of photographs shuffles, spreads into a grid, and each photo gently drifts and tilts before the grid closes back into a stack." },
];
