export const wowTiles = [
  ["PORTRAIT", "AI PHOTOSHOOT"],
  ["PRODUCT", "CAMPAIGN"],
  ["FASHION", "EDITORIAL"],
  ["REAL ESTATE", "CINEMATIC"],
  ["FILM", "CINEMATIC SHORTS"],
  ["BEAUTY", "COMMERCIAL"],
  ["FOOD", "ADVERTISING"],
  ["UGC", "CREATOR CONTENT"],
  ["ART", "DIGITAL ART"],
  ["CAMPAIGN", "BRAND LAUNCH"],
] as const;

// [name, short line on the card, maker, kind, small facts shown under the card, name as written under the card]. Facts come from our own model list (video-models.ts / models.ts): nothing invented, no prices.
export const audience = [
  ["FILM MAKING", "ByteDance video with sound, up to 30 seconds.", "ByteDance", "Video", "Scenes and short films with sound, from text or a start frame.", "Seedance 2.5"],
  ["AI INFLUENCERS", "Multi-shot video with sound and top general motion.", "Kling", "Video", "Multi-shot clips of a character, with sound, from text or pictures.", "Kling 3.0"],
  ["MUSIC VIDEOS", "2K video from text, keyframes or references.", "MiniMax", "Video", "Performance and visual clips for your track, from text, keyframes or references.", "MiniMax H3"],
  ["ADVERTISEMENT", "Long clips up to 30 seconds, with sound.", "Wan", "Video", "Short ads with sound, from text, pictures or clips.", "Wan 3.0 Prime"],
  ["LOOK BOOK", "Google's highest quality image model.", "Google", "Image", "Fashion and styling looks, from reference pictures.", "Nano Banana Pro"],
  ["PRODUCT PHOTOGRAPHY", "OpenAI's newest image model.", "OpenAI", "Image", "Clean product shots, with picture edits.", "GPT Image 2.5"],
] as const;

export const results = ["Fashion", "Automotive", "Products", "Real Estate", "People", "Food", "Beauty", "Advertising", "Interiors", "Travel", "Jewelry", "Sports", "Gaming", "Architecture", "Music", "Fitness"];

// The black "Start creating with Eclipse." card: three white striped bars, each with a number under it that runs up as the bar rises.
// Categories are the owner's (2026-10-17). The numbers are the owner's (2026-10-17). [value, suffix, caption, bar height in stripes]
export const studioStats = [
  [3, "k+", "Creators", 8],
  [100, "k+", "Creations", 12],
  [50, "+", "Countries", 10],
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
