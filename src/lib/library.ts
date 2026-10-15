// The kinds of saved items the Library can be filtered by (also used by the Library tab's shortcuts).
// Ingredients are the reusable references (character, product, scene); the others describe the file's format.
export const LIBRARY_KINDS = ["All", "Ingredients", "Images", "Videos", "Audio"] as const;
export type LibraryKind = (typeof LIBRARY_KINDS)[number];

export const INGREDIENT_ROLES = ["All", "Character", "Product", "Scene"] as const;

// Older links used one tab per role (?kind=Characters); they now land on Ingredients.
const LEGACY = ["Characters", "Products", "Scenes"];

export function resolveKind(k?: string): LibraryKind {
  if (LEGACY.includes(k ?? "")) return "Ingredients";
  return (LIBRARY_KINDS as readonly string[]).includes(k ?? "") ? (k as LibraryKind) : "All";
}
