"use client";

// Moving images to the Bin, bringing them back, and deleting them for good.
async function call(id: string, init: RequestInit): Promise<void> {
  const res = await fetch(`/api/generations/${id}`, { ...init, headers: { "Content-Type": "application/json" } });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? "Something went wrong. Please try again.");
  }
}

export const trashRender = (id: string) => call(id, { method: "PATCH", body: JSON.stringify({ action: "trash" }) });
export const restoreRender = (id: string) => call(id, { method: "PATCH", body: JSON.stringify({ action: "restore" }) });
export const deleteRenderForever = (id: string) => call(id, { method: "DELETE" });
