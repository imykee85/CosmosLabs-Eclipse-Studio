import { Suspense } from "react";
import VideoStudio from "@/components/generate/VideoStudio";

export const dynamic = "force-dynamic";

export default function GeneratePage() {
  return (
    <Suspense>
      <VideoStudio />
    </Suspense>
  );
}
