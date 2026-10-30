// Look-and-feel strip: four real brands' logos (Meta, Netflix, HubSpot, Google) plus six invented brands (Vantora, Quillon, Solenne, Aurevo, Nexalor, Tavira; drawn for Eclipse, not real companies) since 2026-10-30. The owner contacted Anthropic and the brands and confirmed (2026-10-15)
// that mock logos are allowed, so they stay on every build, production included (NEXT_PUBLIC_MOCK_LOGOS in next.config).
// Real customer logos go in customerLogos.ts and replace these automatically, only with the customers' agreement.
export const mockLogos: { name: string; src: string; h: number }[] = [
  { name: "Meta", src: "/logos/mock/meta.svg", h: 37 },
  { name: "Vantora", src: "/logos/mock/vantora.svg", h: 36 },
  { name: "Netflix", src: "/logos/mock/netflix.svg", h: 46 },
  { name: "Quillon", src: "/logos/mock/quillon.svg", h: 44 },
  { name: "HubSpot", src: "/logos/mock/hubspot.svg", h: 46 },
  { name: "Solenne", src: "/logos/mock/solenne.svg", h: 36 },
  { name: "Google", src: "/logos/mock/google.svg", h: 46 },
  { name: "Aurevo", src: "/logos/mock/aurevo.svg", h: 44 },
  { name: "Nexalor", src: "/logos/mock/nexalor.svg", h: 40 },
  { name: "Tavira", src: "/logos/mock/tavira.svg", h: 38 },
];
