// The plain price list under the pricing cards (owner 2026-10-31). Dollars are what a credit is worth at its face value ($0.10, plans make it a little cheaper);
// Seedance is shown at the provider's own per-second cost (it is sold at that rate). A unit test (tests/unit/price-list.test.ts) rebuilds every number
// from the real price tables, so a price change fails it until this list is updated.
export type PriceLine = { label: string; price: string };
export type PriceGroup = { name: string; lines: PriceLine[] };

export const priceList: PriceGroup[] = [
  { name: "Seedance 2.5", lines: [
    { label: "480p", price: "$0.11 / second" },
    { label: "720p", price: "$0.23 / second" },
    { label: "1080p", price: "$0.57 / second" },
  ] },
  { name: "Kling 3.0", lines: [
    { label: "Standard", price: "$0.15 / second" },
    { label: "Pro", price: "$0.20 / second" },
  ] },
  { name: "Nano Banana Pro", lines: [
    { label: "1K and 2K", price: "$0.40 / image" },
    { label: "4K", price: "$0.60 / image" },
  ] },
  { name: "GPT Image 2.5", lines: [
    { label: "1K", price: "$0.20 / image" },
    { label: "2K", price: "$0.50 / image" },
  ] },
  { name: "Seedream 5.0 Pro", lines: [
    { label: "1K", price: "$0.20 / image" },
    { label: "2K", price: "$0.30 / image" },
  ] },
];
