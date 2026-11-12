import { Suspense } from "react";
import DesignStudio from "@/components/design/DesignStudio";

export const dynamic = "force-dynamic";

export default function DesignPage() {
  return (
    <Suspense>
      <DesignStudio />
    </Suspense>
  );
}
