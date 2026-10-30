// Full-bleed background picture for the landing hero (public/hero/hero.jpg, the owner's silhouette-in-light still). The dark wash keeps the headline readable.
export default function HeroImage() {
  return (
    <div className="hero-video" aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="hero-video-still" src="/hero/hero.jpg" alt="" fetchPriority="high" />
      <div className="hero-video-wash" />
    </div>
  );
}
