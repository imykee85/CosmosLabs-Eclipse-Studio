// Full-bleed background picture for the landing hero (public/hero/hero-2.jpg, the owner's silhouette-in-light still (second version)). The dark wash keeps the headline readable.
export default function HeroImage() {
  return (
    <div className="hero-video" aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="hero-video-still" src="/hero/hero-2.jpg" alt="" fetchPriority="high" />
      <div className="hero-video-wash" />
    </div>
  );
}
