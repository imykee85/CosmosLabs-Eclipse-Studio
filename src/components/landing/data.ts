export const wowTiles = [
  ["PORTRAIT", "AI PHOTOSHOOT"],
  ["PRODUCT", "CAMPAIGN"],
  ["FASHION", "EDITORIAL"],
  ["REAL ESTATE", "CINEMATIC"],
  ["BEAUTY", "COMMERCIAL"],
  ["FOOD", "ADVERTISING"],
  ["UGC", "CREATOR CONTENT"],
  ["FILM", "CINEMATIC SHORTS"],
  ["ART", "DIGITAL ART"],
  ["CAMPAIGN", "BRAND LAUNCH"],
] as const;

// [name, short line on the card, maker, kind, small facts shown under the card, name as written under the card]. Facts come from our own model list (video-models.ts / models.ts): nothing invented, no prices.
export const audience = [
  ["SEEDANCE 2.5", "ByteDance video with sound, up to 30 seconds.", "ByteDance", "Video", "Text to video and start-frame video, with sound, 4 to 30 seconds.", "Seedance 2.5"],
  ["KLING 3.0", "Multi-shot video with sound and top general motion.", "Kling", "Video", "Multi-shot clips from text or images, with sound.", "Kling 3.0"],
  ["MINIMAX H3", "2K video from text, keyframes or references.", "MiniMax", "Video", "2K video from text, keyframes or reference files.", "MiniMax H3"],
  ["WAN 3.0 PRIME", "Long clips up to 30 seconds, with sound.", "Wan", "Video", "Clips up to 30 seconds from text, pictures or clips, with sound.", "Wan 3.0 Prime"],
  ["NANO BANANA PRO", "Google's highest quality image model.", "Google", "Image", "Google's highest quality image model, with reference pictures.", "Nano Banana Pro"],
  ["GPT IMAGE 2.5", "OpenAI's newest image model.", "OpenAI", "Image", "OpenAI's newest image model, with picture edits.", "GPT Image 2.5"],
] as const;

export const results = ["Fashion", "Automotive", "Products", "Real Estate", "People", "Food", "Beauty", "Advertising", "Interiors", "Travel", "Jewelry", "Sports"];

// The black "Start creating with Eclipse." card: the steps of the work, lit one after another while each column's bar rises.
// [step, where in Eclipse it happens, bar height in stripes]
export const studioFlow = [
  ["Idea", "With Atlas", 2],
  ["Plan", "Treatment", 4],
  ["Prompt", "Prompts", 6],
  ["Image", "Image Studio", 8],
  ["Video", "Video Studio", 10],
  ["Voice", "Voice Studio", 12],
] as const;

// Lines Atlas "types" beside himself on the homepage: examples of his art direction.
export const atlasDirections = [
  "Shoot it low at golden hour and let the steam catch the light.",
  "Swap the white backdrop for raw concrete. It reads more premium.",
  "Open on the hands, then pull back to reveal the whole kitchen.",
  "Push the reds, deepen the shadows, keep the skin soft.",
  "35mm, shallow focus on the label, a slow push in.",
];

// What Atlas is good at, shown under him in the "Meet Atlas" section. Only what Atlas really does today.
export const atlasStrengths = [
  ["Don't know where to start?", "Brainstorm with Atlas, or hand over your brief. Atlas pulls out the goal, the audience and the gaps, and shapes them into a plan."],
  ["Can't write a high-quality prompt?", "Describe your shot in plain words. Atlas writes a detailed, high-fidelity prompt for the model you are using."],
  ["Need a second pair of eyes?", "Atlas looks at the pictures and videos you share and tells you what works and what needs another take."],
  ["Want a still from your video?", "Atlas finds the moment you mean, captures the frame and saves it to your Assets, ready to use as a start frame."],
  ["Always your call.", "Atlas proposes, you approve. Nothing is made until you press the button."],
] as const;

// The Atlas workflow timeline. Only what Atlas really does today: it proposes, the person approves, nothing renders without a press.
export const atlasSteps = [
  ["01", "TELL ATLAS", "Describe your idea in plain language."],
  ["02", "ATLAS PLANS IT", "Atlas shapes the idea and writes the prompt."],
  ["03", "ATLAS CREATES", "Approve it and your image or video is made."],
  ["04", "REFINE", "Ask for changes and Atlas reworks it."],
  ["05", "KEEP IT", "Every result is saved in your gallery."],
] as const;

export const faqs = [
  ["Do I need AI experience?", "No. Describe what you want in plain language and Eclipse does the rest."],
  ["What can I create?", "Images today, with video and more creative tools on the roadmap."],
  ["Where do my creations go?", "Each generation is saved to your private gallery so you can come back to it."],
  ["Do I need an account?", "Yes. Sign in to generate and to keep your gallery."],
  ["Do I need other AI tools?", "No. Prompt in, finished image out, all in one place."],
] as const;
