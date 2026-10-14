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

export const audience = [
  ["SEEDANCE 2.5", "ByteDance video with sound, up to 30 seconds."],
  ["KLING 3.0", "Multi-shot video with sound and top general motion."],
  ["MINIMAX H3", "2K video from text, keyframes or references."],
  ["WAN 3.0 PRIME", "Long clips up to 30 seconds, with sound."],
  ["NANO BANANA PRO", "Google's highest quality image model."],
  ["GPT IMAGE 2.5", "OpenAI's newest image model."],
] as const;

export const results = ["Fashion", "Automotive", "Products", "Real Estate", "People", "Food", "Beauty", "Advertising"];

export const steps = [
  ["01", "DESCRIBE IT", "Write your idea in plain language."],
  ["02", "GENERATE", "Eclipse sends your prompt to the image model."],
  ["03", "REVIEW", "See the result right away."],
  ["04", "KEEP IT", "Every generation is saved to your gallery."],
] as const;

export const faqs = [
  ["Do I need AI experience?", "No. Describe what you want in plain language and Eclipse does the rest."],
  ["What can I create?", "Images today, with video and more creative tools on the roadmap."],
  ["Where do my creations go?", "Each generation is saved to your private gallery so you can come back to it."],
  ["Do I need an account?", "Yes. Sign in to generate and to keep your gallery."],
  ["Do I need other AI tools?", "No. Prompt in, finished image out, all in one place."],
] as const;
