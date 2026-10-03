import { Suspense } from "react";
import PromptForm from "@/components/PromptForm";

export default function Home() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Create</h1>
      <Suspense>
        <PromptForm />
      </Suspense>
    </div>
  );
}
