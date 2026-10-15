"use client";

import { useEffect, useState } from "react";
import type { PublicModel } from "./models";

export const MODEL_STORAGE_KEY = "eclipse-image-model";

// The models the server says are available. The picker shows these and nothing else. Edit models (they need a reference
// picture) are only included where the page can ask for one: pass { edit: true }.
export function useModels({ edit = false }: { edit?: boolean } = {}): PublicModel[] | null {
  const [models, setModels] = useState<PublicModel[] | null>(null);
  useEffect(() => {
    let live = true;
    fetch("/api/models")
      .then((r) => (r.ok ? r.json() : { models: [] }))
      .then((d) => { if (live) setModels(Array.isArray(d.models) ? (d.models as PublicModel[]).filter((m) => edit || !m.requiresReference) : []); })
      .catch(() => { if (live) setModels([]); });
    return () => { live = false; };
  }, [edit]);
  return models;
}

export function rememberedModel(models: PublicModel[]): PublicModel | undefined {
  let id: string | null = null;
  try { id = localStorage.getItem(MODEL_STORAGE_KEY); } catch {}
  return models.find((m) => m.id === id) ?? models[0];
}
