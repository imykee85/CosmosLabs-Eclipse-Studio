// Other companies' logos shown as a look-and-feel strip. The owner contacted Anthropic and the brands and confirmed (2026-10-15)
// that mock logos are allowed, so they stay on every build, production included (NEXT_PUBLIC_MOCK_LOGOS in next.config).
// Real customer logos go in customerLogos.ts and replace these automatically, only with the customers' agreement.
export const mockLogos: { name: string; src: string; h: number }[] = [
  { name: "Meta", src: "/logos/mock/meta.svg", h: 37 },
  { name: "Netflix", src: "/logos/mock/netflix.svg", h: 46 },
  { name: "Ford", src: "/logos/mock/ford.svg", h: 28 },
  { name: "Hilton", src: "/logos/mock/hilton.svg", h: 28 },
  { name: "Siemens", src: "/logos/mock/siemens.svg", h: 22 },
  { name: "HubSpot", src: "/logos/mock/hubspot.svg", h: 46 },
  { name: "Cisco", src: "/logos/mock/cisco.svg", h: 33 },
  { name: "Mastercard", src: "/logos/mock/mastercard.svg", h: 36 },
  { name: "Google", src: "/logos/mock/google.svg", h: 46 },
  { name: "Nvidia", src: "/logos/mock/nvidia.svg", h: 37 },
];
