// The kinds of saved items the Library can be filtered by (also used by the Library tab's shortcuts).
export const LIBRARY_KINDS = ["All", "Characters", "Products", "Scenes", "Images", "Videos"] as const;
export type LibraryKind = (typeof LIBRARY_KINDS)[number];

export function resolveKind(k?: string): LibraryKind {
  return (LIBRARY_KINDS as readonly string[]).includes(k ?? "") ? (k as LibraryKind) : "All";
}
