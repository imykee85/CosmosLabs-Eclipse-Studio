import type { MetadataRoute } from "next";

// What the phone uses when someone adds Eclipse to the home screen: the name under the icon, the icon itself (our logo mark on
// black) and how it opens. "standalone" opens it like an app, without the browser bars; use "minimal-ui" to keep a back/reload bar.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Eclipse Studio",
    short_name: "Eclipse",
    description: "Turn any idea into premium images. By Cosmos Labs AI.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#000000",
    theme_color: "#000000",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
