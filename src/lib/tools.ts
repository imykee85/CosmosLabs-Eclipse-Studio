// Tools: small single-purpose creative tools (a character sheet, a thumbnail maker...). Opening one starts a Connect chat
// with `start` as the first message, and the assistant works the job with its own tools (render, remember, send).
// Wording is Eclipse's own; previews are Eclipse's sample content.
export type Tool = { id: string; name: string; blurb: string; kind: "Photo" | "Video"; image: string; headline: string; start: string };

export const tools: Tool[] = [
  { id: "sheet", name: "Character sheet", blurb: "One character, shown from every angle with close-ups and expressions.", kind: "Photo", image: "/carousel/card-6-poster.jpg", headline: "Character sheet", start: "Make a character sheet. Ask me about the character first if you need to, then show them from every angle with close-ups and a few expressions." },
  { id: "thumb", name: "Thumbnail maker", blurb: "Scroll-stopping thumbnails for your videos in a few taps.", kind: "Photo", image: "/carousel/card-4-poster.jpg", headline: "Thumbnail maker", start: "Help me make a thumbnail for my video. Ask what the video is about, then make three options." },
  { id: "story", name: "Storyboard", blurb: "Turn a script into a frame-by-frame board you can review.", kind: "Photo", image: "/carousel/card-8.jpg", headline: "Storyboard", start: "Turn my script into a storyboard. I will paste the script next; plan the frames and render them." },
  { id: "mock", name: "Product mockups", blurb: "Place your product in lifestyle scenes and packaging shots.", kind: "Photo", image: "/carousel/card-5.jpg", headline: "Product mockups", start: "Place my product in lifestyle scenes and packaging shots. Ask me what the product is." },
  { id: "drama", name: "Micro drama", blurb: "Short scripted scenes with the same characters from episode to episode.", kind: "Video", image: "/carousel/card-9-poster.jpg", headline: "Micro drama", start: "Plan a short scripted micro drama with recurring characters and render key frames for the first scene." },
  { id: "look", name: "Lookbook builder", blurb: "Arrange a wardrobe into editorial pages and a shareable lookbook.", kind: "Photo", image: "/carousel/card-2-poster.jpg", headline: "Lookbook builder", start: "Build a lookbook from my wardrobe. Ask me about the pieces, then render editorial pages." },
];
