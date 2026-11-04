import type Anthropic from "@anthropic-ai/sdk";
import { toolDefs, runTool } from "@/lib/connect-tools";

// Atlas shares some of Core's tools: finding the person's work and keeping memory. They only READ the Library and projects, or save and
// delete short memory notes; nothing here starts a render or spends credits. Rendering stays a button the person presses.
// Library and projects belong to the WORKSPACE (a person's own or their team's); memory belongs to the PERSON.
const LIBRARY = ["list_projects", "search_library", "list_recent_renders", "check_render", "view_render"] as const;
const MEMORY = ["remember", "recall", "forget"] as const;
export const CORE_TOOL_NAMES: readonly string[] = [...LIBRARY, ...MEMORY];
export const isCoreTool = (n: string) => CORE_TOOL_NAMES.includes(n);

export const CORE_TOOLS: Anthropic.Tool[] = toolDefs
  .filter((t) => isCoreTool(t.name))
  .map((t) => ({ name: t.name, description: t.description, input_schema: t.input_schema as Anthropic.Tool["input_schema"] }));

export const CORE_TOOLS_NOTE = `You can also look at the person's work and keep notes: list_projects, search_library, list_recent_renders, check_render and view_render read their projects and finished renders (use them to reuse or build on what exists instead of starting over, and ask before looking at many pictures); remember, recall and forget keep short facts about their style, products and tastes across chats. Save a memory only when the person says something worth keeping, say in one short line that you saved it, and never save secrets. None of these start a render or cost credits: making something new is always a button the person presses. You cannot edit a finished video yourself, but Core can (Tools, Video editor): cut, join, speed, vertical or square, pauses removed, captions, a title card, music, loudness and exports for Reels, TikTok, Shorts and YouTube. When the person wants that, say so and offer to write the edit plan for them (which clips, the cuts, the caption text) to take to Core.`;

export type CoreRun = { content: Anthropic.ToolResultBlockParam["content"]; isError?: boolean };

export async function runCoreTool(workspaceId: string, personId: string, name: string, input: Record<string, unknown>): Promise<CoreRun> {
  const owner = (MEMORY as readonly string[]).includes(name) ? personId : workspaceId;
  const out = await runTool(name, input, { userId: owner, projectId: null, onRender: () => {} });
  const content: Anthropic.ToolResultBlockParam["content"] = out.image
    ? [{ type: "text", text: out.text }, { type: "image", source: { type: "base64", media_type: out.image.mediaType, data: out.image.data } }]
    : out.text;
  return { content, isError: out.isError };
}
