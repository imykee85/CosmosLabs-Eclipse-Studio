import { nodeTypes as base } from "./nodes";
import { AssistantNode, EditorNode, GroupNode, ListNode, Model3DNode, MusicNode, SfxNode, UpscalerNode, VariationsNode, VoiceoverNode } from "./tool-nodes";

// Every node the canvas can show: the original ones (nodes.tsx) and the wrapper nodes, List and Group (tool-nodes.tsx).
export const nodeTypes = { ...base, assistant: AssistantNode, voiceover: VoiceoverNode, sfx: SfxNode, music: MusicNode, editor: EditorNode, upscaler: UpscalerNode, variations: VariationsNode, list: ListNode, group: GroupNode, model3d: Model3DNode };
