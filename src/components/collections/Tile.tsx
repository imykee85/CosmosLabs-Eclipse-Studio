import type { PremiumItem } from "@/lib/premium";

// A picture, or a clip that plays muted on a loop in the grid and with controls on the item's own page.
export default function Tile({ item, controls = false }: { item: PremiumItem; controls?: boolean }) {
  const style = { aspectRatio: item.ratio ?? "4 / 5" };
  if (item.kind === "video") {
    return <video className="mo-tile mo-video" style={style} src={item.src} poster={item.poster} muted={!controls} loop={!controls} autoPlay={!controls} playsInline controls={controls} preload={controls ? "metadata" : "none"} aria-label={item.title} />;
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img className="mo-tile" style={style} src={item.src} alt={item.title} loading="lazy" draggable={false} />;
}
