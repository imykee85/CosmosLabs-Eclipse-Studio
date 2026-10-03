"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";

type Result = { id: string; prompt: string; imageUrl: string };

export default function PromptForm() {
  const [prompt, setPrompt] = useState(useSearchParams().get("prompt") ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong");
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      <form onSubmit={onSubmit} className="space-y-4">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={4}
          maxLength={2000}
          placeholder="Describe the image you want to create…"
          className="w-full rounded-lg border border-neutral-700 bg-neutral-900 p-4 text-neutral-100 placeholder-neutral-500 focus:border-neutral-400 focus:outline-none"
        />
        <button
          type="submit"
          disabled={loading || !prompt.trim()}
          className="rounded-lg bg-[#b0261b] px-5 py-2.5 font-medium text-white hover:bg-[#c4392d] disabled:opacity-50"
        >
          {loading ? "Generating…" : "Generate"}
        </button>
        {error && <p className="text-sm text-red-400">{error}</p>}
      </form>

      {result && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={result.imageUrl} alt={result.prompt} className="w-full max-w-xl rounded-lg" />
      )}
    </div>
  );
}
