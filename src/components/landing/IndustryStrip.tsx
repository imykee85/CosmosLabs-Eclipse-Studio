import { customerLogos } from "./customerLogos";
import { Building2, Car, Flower2, Megaphone, Package, Shirt, User, UtensilsCrossed } from "lucide-react";

// Auto-scrolling strip under the hero carousel. With real customer logos (see customerLogos.ts) it reads
// "Trusted by teams at"; until then it lists the kinds of content Eclipse is made for.
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
      {customerLogos.length > 0
        ? customerLogos.map(({ name, src }) => (
            // eslint-disable-next-line @next/next/no-img-element
            <li key={name} className="strip-logo"><img src={src} alt={hidden ? "" : name} height={36} /></li>
          ))
        : items.map(({ name, Icon }) => (
            <li key={name}><Icon size={22} strokeWidth={1.6} /><span>{name}</span></li>
          ))}
    </ul>
  );
}

export default function IndustryStrip() {
  return (
    <section className="strip" aria-label="What Eclipse is made for">
      <p className="strip-label">{customerLogos.length > 0 ? "TRUSTED BY TEAMS AT" : "MADE FOR BRANDS IN"}</p>
      <div className="strip-viewport">
        <div className="strip-track">
          <Set />
          <Set hidden />
        </div>
      </div>
    </section>
  );
}
