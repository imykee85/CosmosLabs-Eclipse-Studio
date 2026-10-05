import { Building2, Car, Flower2, Megaphone, Package, Shirt, User, UtensilsCrossed } from "lucide-react";

// Auto-scrolling strip under the hero carousel. It lists the kinds of content Eclipse is made for.
// When there are real customers to show (with their permission), replace these items with their logos.
const items = [
  { name: "Fashion", Icon: Shirt },
  { name: "Automotive", Icon: Car },
  { name: "Products", Icon: Package },
  { name: "Real Estate", Icon: Building2 },
  { name: "People", Icon: User },
  { name: "Food", Icon: UtensilsCrossed },
  { name: "Beauty", Icon: Flower2 },
  { name: "Advertising", Icon: Megaphone },
];

function Set({ hidden = false }: { hidden?: boolean }) {
  return (
    <ul className="strip-set" aria-hidden={hidden || undefined}>
      {items.map(({ name, Icon }) => (
        <li key={name}><Icon size={22} strokeWidth={1.6} /><span>{name}</span></li>
      ))}
    </ul>
  );
}

export default function IndustryStrip() {
  return (
    <section className="strip" aria-label="What Eclipse is made for">
      <p className="strip-label">MADE FOR BRANDS IN</p>
      <div className="strip-viewport">
        <div className="strip-track">
          <Set />
          <Set hidden />
        </div>
      </div>
    </section>
  );
}
