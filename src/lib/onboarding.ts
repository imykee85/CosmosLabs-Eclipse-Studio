// Onboarding questions, shared by the UI and the API route (which validates answers against them).
export type Question = {
  id: "usage" | "experience" | "audience" | "contentType" | "source" | "blocker";
  title: string;
  options: string[];
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
    title: "What's your biggest challenge right now?",
    options: ["Cost", "Time", "Consistent quality", "Too many separate tools", "Getting approvals"],
  },
];

export type Answers = Record<Question["id"], string>;

export function validAnswers(body: unknown): Answers | null {
  if (!body || typeof body !== "object") return null;
  const out = {} as Answers;
  for (const q of questions) {
    const v = (body as Record<string, unknown>)[q.id];
    if (typeof v !== "string" || !q.options.includes(v)) return null;
    out[q.id] = v;
  }
  return out;
}
