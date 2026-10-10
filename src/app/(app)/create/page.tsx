import { Suspense } from "react";
import CreateStudio from "@/components/create/CreateStudio";

export const dynamic = "force-dynamic";

export default function CreatePage() {
  return (
    <Suspense>
      <CreateStudio />
    </Suspense>
  );
}
