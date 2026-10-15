// Onboarding questions, shared by the UI and the API route (which validates answers against them).
export type QuestionId = "usage" | "experience" | "audience" | "contentType" | "source" | "blocker";

export type Question = {
  id: QuestionId;
  title: string;
  options: string[];
  multi?: boolean; // several options can be chosen
};

export const questions: Question[] = [
  { id: "usage", title: "How will you use Eclipse?", options: ["Personal", "With my team"] },
  {
    id: "experience",
    title: "How much experience do you have with AI content?",
    options: ["Just getting started", "I've used AI tools before", "It's part of my job"],
  },
  { id: "audience", title: "Who are you creating for?", options: ["Myself or my own brand", "Clients"] },
  { id: "contentType", title: "What will you make most?", options: ["Product and ad visuals", "Social media content"] },
  {
    id: "source",
    title: "Where did you hear about Eclipse?",
    options: ["Instagram", "TikTok", "YouTube", "A friend or colleague", "Search engine", "Somewhere else"],
  },
  {
    id: "blocker",
    title: "What are your biggest challenges right now?",
    options: ["Cost", "Time", "Consistent quality", "Too many separate tools", "Getting approvals"],
    multi: true,
  },
];

export type Answers = {
  usage: string;
  experience: string;
  audience: string;
  contentType: string;
  source: string;
  blocker: string[];
};

export function validAnswers(body: unknown): Answers | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  const out: Record<string, string | string[]> = {};
  for (const q of questions) {
    const v = b[q.id];
    if (q.multi) {
      if (!Array.isArray(v) || v.length === 0) return null;
      const picked = Array.from(new Set(v));
      if (!picked.every((x) => typeof x === "string" && q.options.includes(x))) return null;
      out[q.id] = picked as string[];
    } else {
      if (typeof v !== "string" || !q.options.includes(v)) return null;
      out[q.id] = v;
    }
  }
  return out as unknown as Answers;
}
