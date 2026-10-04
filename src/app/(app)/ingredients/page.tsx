import Link from "next/link";
import { ArrowRight, Box, Clapperboard, Plus, User } from "lucide-react";

const kinds = [
  { icon: User, title: "Character", copy: "A person or spokesperson to anchor your content." },
  { icon: Box, title: "Product", copy: "Your product, locked in so it looks the same in every shot." },
  { icon: Clapperboard, title: "Scene", copy: "The setting or environment your content takes place in." },
];

export default function IngredientsPage() {
  return (
    <div className="ws-ing">
      <h1>Ingredients</h1>
      <p>The building blocks of your project. Set them once and reuse them in every generation so your content stays consistent.</p>
      <Link href="/create" className="ws-ghost">Continue to Create <ArrowRight size={15} /></Link>

      <div className="ws-kinds">
        {kinds.map(({ icon: Icon, title, copy }) => (
          <div key={title} className="ws-kind is-soon" aria-disabled="true">
            <span className="ws-card-icon"><Icon size={20} /></span>
            <h2>{title}</h2>
            <p>{copy}</p>
            <em className="ws-soon">Soon</em>
          </div>
        ))}
      </div>

      <section className="ws-ing-empty">
        <h2>No ingredients in this project yet</h2>
        <p>Link ingredients from your library, or create new ones above.</p>
        <button type="button" className="ws-add" disabled><Plus size={16} /> Add ingredient</button>
        <small>Saving ingredients is coming soon.</small>
      </section>
    </div>
  );
}
