"use client";

import { useCallback, useEffect, useState } from "react";

// The agents this person made, kept in step with the account (GET /api/user-agents) and remembered in this browser so the agent chip can check a saved choice at once.
export type CustomAgent = { id: string; name: string; role: string; instructions: string };
const KEY = "eclipse-custom-agents";
const EVENT = "eclipse-custom-agents-change";

export function readCustomAgents(): CustomAgent[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(raw) ? raw.filter((a) => a && typeof a.id === "string" && typeof a.name === "string") : [];
  } catch { return []; }
}
const write = (list: CustomAgent[]) => { try { localStorage.setItem(KEY, JSON.stringify(list)); } catch {} window.dispatchEvent(new Event(EVENT)); };

export function useCustomAgents() {
  const [agents, setAgents] = useState<CustomAgent[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    setAgents(readCustomAgents());
    const on = () => setAgents(readCustomAgents());
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, []);
  const reload = useCallback(async () => {
    try {
      const res = await fetch("/api/user-agents");
      if (!res.ok) return; // preview mode or signed out: keep what the browser has
      const data = await res.json();
      if (Array.isArray(data.items)) write(data.items);
    } catch {}
  }, []);
  useEffect(() => { void reload(); }, [reload]);

  const create = useCallback(async (input: { name: string; role: string; instructions: string }): Promise<CustomAgent | null> => {
    setError("");
    try {
      const res = await fetch("/api/user-agents", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(typeof data.error === "string" ? data.error : "Could not save the agent."); return null; }
      write([...readCustomAgents(), data]);
      return data as CustomAgent;
    } catch { setError("Could not reach the server. Check your connection and try again."); return null; }
  }, []);

  const remove = useCallback(async (id: string): Promise<boolean> => {
    setError("");
    try {
      const res = await fetch(`/api/user-agents/${id}`, { method: "DELETE" });
      if (!res.ok) { setError("Could not delete the agent."); return false; }
      write(readCustomAgents().filter((a) => a.id !== id));
      return true;
    } catch { setError("Could not reach the server. Check your connection and try again."); return false; }
  }, []);

  return { agents, error, create, remove, reload };
}
