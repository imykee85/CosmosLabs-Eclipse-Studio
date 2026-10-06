export type CarouselItem = {
  type: "image" | "video";
  src: string;
  poster?: string; // still frame shown instantly while a video loads
};

const CDN = "https://d2xsxph8kpxj0f.cloudfront.net/310519663334929625/8NmtnY8reYpdTbSELMfqF6";

// Same 14 items, same order as the Manus export. Files under /carousel/ live in
// public/carousel/ (copy them over from the old project using the same filenames).
export const carouselItems: CarouselItem[] = [
  { type: "image", src: `${CDN}/combined_fashion_scene_9_16_79e28af5.png` },
  { type: "video", src: "/carousel/card-2.mp4", poster: "/carousel/card-2-poster.jpg" },
  { type: "image", src: `${CDN}/serum_bottle_exact_skintone_944b93f0.png` },
  { type: "video", src: "/carousel/card-4.mp4", poster: "/carousel/card-4-poster.jpg" },
  { type: "image", src: "/carousel/card-5.jpg" },
  { type: "video", src: "/carousel/card-6.mp4", poster: "/carousel/card-6-poster.jpg" },
  { type: "image", src: `${CDN}/fixed_portrait_ba325a03.png` },
  { type: "video", src: "/carousel/carousel_content_8_replacement_ff08a352.mp4" },
  { type: "image", src: "/carousel/edited_interior_b06d0562.png" },
  { type: "video", src: "/carousel/carousel_video_2_370204a0.mp4" },
  { type: "image", src: "/carousel/IMG_9019_3d9a93fb.jpg" },
  { type: "image", src: "/carousel/composite_fashion_image_v3_67d23662.png" },
  { type: "image", src: "/carousel/handbag_collection_stacked_grey_9a4d2593.png" },
  { type: "image", src: "/carousel/mediterranean_woman_new_shadow_9d6bec31.jpg" },
];
