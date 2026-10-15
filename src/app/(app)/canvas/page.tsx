import { Suspense } from "react";
import CanvasPage from "@/components/canvas/CanvasPage";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <Suspense>
      <CanvasPage />
    </Suspense>
  );
}
