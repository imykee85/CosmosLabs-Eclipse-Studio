import { nodeTypes as base } from "./nodes";
import { AssistantNode, EditorNode, GroupNode, ListNode, MusicNode, SfxNode, RetouchNode, UpscalerNode, VariationsNode, VoiceoverNode } from "./tool-nodes";

// Every node the canvas can show: the original ones (nodes.tsx) and the wrapper nodes, List and Group (tool-nodes.tsx).
export const nodeTypes = { ...base, assistant: AssistantNode, voiceover: VoiceoverNode, sfx: SfxNode, music: MusicNode, editor: EditorNode, upscaler: UpscalerNode, retouch: RetouchNode, variations: VariationsNode, list: ListNode, group: GroupNode };
