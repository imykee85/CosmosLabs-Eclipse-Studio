// The MCP "prompts" of Eclipse: ready-made commands the MCP client shows as slash commands (in Claude Code they are /mcp__eclipse__image, /mcp__eclipse__atlas and so on).
// Each one hands Claude a short, exact instruction that uses Eclipse's tools, so a person types the command and what they want, not how to call the tools.
type Json = Record<string, unknown>;
type Arg = { name: string; description: string; required?: boolean };
type Def = { name: string; title: string; description: string; arguments: Arg[]; text: (a: Record<string, string>) => string };

const POLL = "Renders run in the background: poll get_render every few seconds until its status is completed (or failed), then show the user the url, the model and the credits it cost. Never repeat a render the user did not ask for.";
const val = (a: Json, k: string) => (typeof a[k] === "string" ? (a[k] as string).trim().slice(0, 4000) : "");

const DEFS: Def[] = [
  { name: "image", title: "Make an image in Eclipse", description: "Make one image from an idea.", arguments: [
      { name: "idea", description: "What the picture should show.", required: true }, { name: "model", description: "A model id from list_models (optional: pick a good one)." }, { name: "aspect_ratio", description: "For example 1:1, 4:5, 16:9 (optional)." } ],
    text: (a) => `Make an image in my Eclipse Studio account.\nIdea: ${a.idea}\n${a.model ? `Use the model ${a.model}.` : "Call list_models and pick the best fitting image model."} ${a.aspect_ratio ? `Aspect ratio ${a.aspect_ratio}.` : ""}\nWrite a detailed prompt from the idea, then call generate_image. ${POLL}` },
  { name: "video", title: "Make a video in Eclipse", description: "Make one video from an idea.", arguments: [
      { name: "idea", description: "What happens in the video.", required: true }, { name: "model", description: "A video model id from list_models (optional)." }, { name: "length", description: "Seconds (optional)." } ],
    text: (a) => `Make a video in my Eclipse Studio account.\nIdea: ${a.idea}\n${a.model ? `Use the model ${a.model}.` : "Call list_models and pick the best fitting video model."} ${a.length ? `Length ${a.length} seconds.` : ""}\nWrite a detailed video prompt, then call generate_video. If it answers needs_confirm, tell me the cost and wait for my yes before calling again with confirm set to true. ${POLL}` },
  { name: "atlas", title: "Ask Atlas", description: "Ask Atlas, Eclipse's creative partner, to plan or write a prompt.", arguments: [
      { name: "request", description: "What you want Atlas to help with.", required: true } ],
    text: (a) => `Ask Atlas (the ask_atlas tool) for this, passing my words as the message: ${a.request}\nShow me Atlas's answer in full, including any prompt it writes, in a code block. Do not start a render. Ask me whether to make it, and if I say yes use generate_image or generate_video with the prompt Atlas wrote.` },
  { name: "storyboard", title: "Storyboard a Seedance video with Atlas", description: "Have Atlas write a Seedance 2.5 prompt for a scene.", arguments: [
      { name: "scene", description: "The scene, mood and length you want.", required: true } ],
    text: (a) => `Ask Atlas (ask_atlas) to write a timed Seedance 2.5 video prompt for this scene, naming the length in seconds: ${a.scene}\nShow me the prompt in a code block exactly as Atlas wrote it. Then ask me if I want the video made; if yes call generate_video with model seedance_2_5 and that prompt. ${POLL}` },
  { name: "core", title: "Ask Core", description: "Hand a task to Core, Eclipse's creative computer.", arguments: [
      { name: "request", description: "The task for Core.", required: true }, { name: "chat_id", description: "Continue an earlier Core chat (optional)." } ],
    text: (a) => `Send this to Core (the ask_core tool)${a.chat_id ? ` in chat ${a.chat_id}` : ""}: ${a.request}\nShow me Core's reply and remember the chat_id it returns so we can keep talking in the same chat. If Core starts pictures (renders_started), poll each with get_render and show me the results. ${POLL}` },
  { name: "balance", title: "Eclipse credits and latest renders", description: "Show my credits and my newest renders.", arguments: [],
    text: () => "Call get_credits and list_renders (limit 8). Show my credit balance and, for each render, its kind, status, prompt (shortened) and url if completed." },
];

export const MCP_PROMPTS = DEFS.map((d) => ({ name: d.name, title: d.title, description: d.description, arguments: d.arguments }));

/** The messages of one prompt, or null when the name is unknown. A missing required argument is asked for, never invented. */
export function getPrompt(name: string, args: Json): { description: string; messages: { role: "user"; content: { type: "text"; text: string } }[] } | null {
  const d = DEFS.find((x) => x.name === name);
  if (!d) return null;
  const a: Record<string, string> = {};
  for (const arg of d.arguments) a[arg.name] = val(args, arg.name);
  const missing = d.arguments.find((x) => x.required && !a[x.name]);
  const text = missing ? `The ${d.title.toLowerCase()} command needs "${missing.name}" (${missing.description}). Ask me for it, then continue.` : d.text(a);
  return { description: d.description, messages: [{ role: "user", content: { type: "text", text } }] };
}
