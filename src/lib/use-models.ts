"use client";

import { useEffect, useState } from "react";
import type { PublicModel } from "./models";

export const MODEL_STORAGE_KEY = "eclipse-image-model";

// The models the server says are available. The picker shows these and nothing else.
export function useModels(): PublicModel[] | null {
  const [models, setModels] = useState<PublicModel[] | null>(null);
  useEffect(() => {
    let live = true;
    fetch("/api/models")
      .then((r) => (r.ok ? r.json() : { models: [] }))
      .then((d) => { if (live) setModels(Array.isArray(d.models) ? d.models : []); })
      .catch(() => { if (live) setModels([]); });
    return () => { live = false; };
  }, []);
  return models;
}

export function rememberedModel(models: PublicModel[]): PublicModel | undefined {
  let id: string | null = null;
  try { id = localStorage.getItem(MODEL_STORAGE_KEY); } catch {}
  return models.find((m) => m.id === id) ?? models[0];
}
