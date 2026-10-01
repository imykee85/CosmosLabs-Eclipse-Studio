import PromptForm from "@/components/PromptForm";

export default function Home() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Create</h1>
      <PromptForm />
    </div>
  );
}
