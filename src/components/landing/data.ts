export const wowTiles = [
  ["PORTRAIT", "AI PHOTOSHOOT"],
  ["PRODUCT", "CAMPAIGN"],
  ["FASHION", "EDITORIAL"],
  ["REAL ESTATE", "CINEMATIC"],
  ["BEAUTY", "COMMERCIAL"],
  ["FOOD", "ADVERTISING"],
] as const;

export const audience = [
  ["MYSELF", "Photoshoots, personal content and social visuals."],
  ["MY PRODUCT", "Turn a simple product photo into a polished campaign."],
  ["MY BRAND", "Content for socials, ads and launches."],
  ["FASHION", "Editorials, lookbooks and product content."],
  ["REAL ESTATE", "Properties presented as cinematic visuals."],
  ["FOOD & BEAUTY", "Premium commercial content for your business."],
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
