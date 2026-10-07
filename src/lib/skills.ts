// Skills: ready-made creative recipes an agent can run for you (a shoot, a campaign, a short video). Everything is "Soon":
// running one needs the agents and generation backend. Wording is Eclipse's own; previews are Eclipse's sample content.
export type Skill = { id: string; name: string; blurb: string; minutes: number; image: string; kind: "photo" | "video" };

export const skills: Skill[] = [
  { id: "product", name: "Product photoshoot", blurb: "Turn one product photo into a set of polished campaign shots.", minutes: 4, image: "/carousel/card-5.jpg", kind: "photo" },
  { id: "interior", name: "Interior styling", blurb: "Restyle a room in several looks while keeping the layout.", minutes: 5, image: "/carousel/card-8.jpg", kind: "photo" },
  { id: "short", name: "Short product video", blurb: "A vertical clip for socials, from a single prompt and a photo.", minutes: 8, image: "/carousel/card-4-poster.jpg", kind: "video" },
  { id: "fashion", name: "Fashion lookbook", blurb: "Editorial looks with a consistent model and wardrobe.", minutes: 6, image: "/carousel/card-2-poster.jpg", kind: "photo" },
  { id: "portrait", name: "Portrait shoot", blurb: "Studio-quality portraits of one person across several styles.", minutes: 4, image: "/carousel/card-9-poster.jpg", kind: "photo" },
  { id: "campaign", name: "Brand campaign", blurb: "A full set of matching visuals and clips for a launch.", minutes: 12, image: "/carousel/card-6-poster.jpg", kind: "video" },
];
