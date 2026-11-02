"use client";

import Link from "next/link";
import { ChevronLeft, Crown } from "lucide-react";
import type { PremiumCollection, PremiumItem } from "@/lib/premium";
import Tile from "./Tile";
import "../motion/motion.css";
import "./collections.css";

// One premium collection: a grid like Motion graphics. Everyone sees the pictures and clips; each item's page shows its prompt to Growth and Scale.
export default function CollectionView({ collection, items }: { collection: PremiumCollection; items: PremiumItem[] }) {
  return (
    <div className="mo">
      <Link href="/dashboard" className="mo-back"><ChevronLeft size={18} /> Dashboard</Link>
      <header className="mo-intro">
        <h1>{collection.name} <Crown className="pc-crown" size={20} aria-hidden="true" /></h1>
        <p>{collection.blurb}</p>
      </header>
      {items.length === 0 ? (
        <p className="mo-empty">Nothing here yet.</p>
      ) : (
        <ul className="mo-grid">
          {items.map((i) => (
            <li key={i.id}>
              <Link href={`/collections/${collection.slug}/${i.id}`} className="mo-card" aria-label={`Open ${i.title}`}><Tile item={i} /></Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
