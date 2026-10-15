// PLACEHOLDER plans: names, prices and credit amounts are not final. Edit them here once pricing is decided.
export type Plan = { id: string; name: string; price: number; credits: number; seats: number };

export const plans: Plan[] = [
  { id: "starter", name: "Starter", price: 19, credits: 1000, seats: 1 },
  { id: "growth", name: "Growth", price: 49, credits: 5000, seats: 3 },
  { id: "scale", name: "Scale", price: 199, credits: 25000, seats: 10 },
];
