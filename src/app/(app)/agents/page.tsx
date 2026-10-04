import AgentPicker from "@/components/workspace/AgentPicker";

export default function AgentsPage() {
  return (
    <div className="ws-ing">
      <h1>Agents</h1>
      <p>Pick the agent you want to work with. Your choice is remembered on this device.</p>
      <AgentPicker />
    </div>
  );
}
