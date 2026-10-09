"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { ArrowRight, Box, Clapperboard, User } from "lucide-react";
import type { UploadKind } from "@/lib/uploads";
import UploadPanel from "./UploadPanel";

const kinds = [
  { kind: "character" as const, icon: User, title: "Character", copy: "A person or spokesperson to anchor your content." },
  { kind: "product" as const, icon: Box, title: "Product", copy: "Your product, locked in so it looks the same in every shot." },
  { kind: "scene" as const, icon: Clapperboard, title: "Scene", copy: "The setting or environment your content takes place in." },
];
const ADD_KINDS: UploadKind[] = ["character", "product", "scene"];

export default function IngredientsView() {
  const [openWith, setOpenWith] = useState<UploadKind | null>(null);
  const opened = useCallback(() => setOpenWith(null), []);
  return (
    <div className="ws-ing">
      <h1>Ingredients</h1>
      <p>The building blocks of your project. Set them once and reuse them in every generation so your content stays consistent.</p>
      <Link href="/create" className="ws-ghost">Continue to Create <ArrowRight size={15} /></Link>

      <div className="ws-kinds">
        {kinds.map(({ kind, icon: Icon, title, copy }) => (
          <button key={kind} type="button" className="ws-kind up-kind" onClick={() => setOpenWith(kind)}>
            <span className="ws-card-icon"><Icon size={20} /></span>
            <h2>{title}</h2>
            <p>{copy}</p>
          </button>
        ))}
      </div>

      <UploadPanel show="ingredients" addKinds={ADD_KINDS} openWith={openWith} onOpened={opened} addLabel="Add ingredient" empty={{ title: "No ingredients yet", copy: "Add a character, product or scene picture above and it will show up here." }} />
    </div>
  );
}
