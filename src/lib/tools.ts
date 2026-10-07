// Tools: small single-purpose creative tools (a character sheet, a thumbnail maker...) that agents and you can open from Connect.
// Everything is "Soon": each one needs the generation backend. Wording is Eclipse's own; previews are Eclipse's sample content.
export type Tool = { id: string; name: string; blurb: string; kind: "Photo" | "Video"; image: string; headline: string };

export const tools: Tool[] = [
  { id: "sheet", name: "Character sheet", blurb: "One character, shown from every angle with close-ups and expressions.", kind: "Photo", image: "/carousel/card-6-poster.jpg", headline: "Character sheet" },
  { id: "thumb", name: "Thumbnail maker", blurb: "Scroll-stopping thumbnails for your videos in a few taps.", kind: "Photo", image: "/carousel/card-4-poster.jpg", headline: "Thumbnail maker" },
  { id: "story", name: "Storyboard", blurb: "Turn a script into a frame-by-frame board you can review.", kind: "Photo", image: "/carousel/card-8.jpg", headline: "Storyboard" },
  { id: "mock", name: "Product mockups", blurb: "Place your product in lifestyle scenes and packaging shots.", kind: "Photo", image: "/carousel/card-5.jpg", headline: "Product mockups" },
  { id: "drama", name: "Micro drama", blurb: "Short scripted scenes with the same characters from episode to episode.", kind: "Video", image: "/carousel/card-9-poster.jpg", headline: "Micro drama" },
  { id: "look", name: "Lookbook builder", blurb: "Arrange a wardrobe into editorial pages and a shareable lookbook.", kind: "Photo", image: "/carousel/card-2-poster.jpg", headline: "Lookbook builder" },
];
