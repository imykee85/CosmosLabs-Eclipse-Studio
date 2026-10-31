// The plain price list under the pricing cards (owner 2026-10-31). Every price is the model maker's own cost, rounded up to the next cent per generation
// (a credit is $0.10 of the maker's cost, the ledger counts in tenths); the plan's price carries the studio fee. A unit test (tests/unit/price-list.test.ts) rebuilds every number
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
    { label: "Standard", price: "$0.08 / second" },
    { label: "Pro", price: "$0.11 / second" },
  ] },
  { name: "Nano Banana Pro", lines: [
    { label: "1K and 2K", price: "$0.14 / image" },
    { label: "4K", price: "$0.24 / image" },
  ] },
  { name: "GPT Image 2.5", lines: [
    { label: "1K", price: "$0.06 / image" },
    { label: "2K", price: "$0.20 / image" },
  ] },
  { name: "Seedream 5.0 Pro", lines: [
    { label: "1K", price: "$0.07 / image" },
    { label: "2K", price: "$0.10 / image" },
  ] },
];
