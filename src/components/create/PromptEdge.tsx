// The one message that sits on the top edge of a prompt box: an error (red) or a short notice. It replaces the lines that used to sit under the box.
export type EdgeMessage = { kind: "error" | "note"; text: string } | null;

export default function PromptEdge({ message }: { message: EdgeMessage }) {
  if (!message) return null;
  return <div className={`cr-edge is-${message.kind}`} role={message.kind === "error" ? "alert" : "status"}>{message.text}</div>;
}
