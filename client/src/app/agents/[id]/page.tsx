import { AgentEditorShell } from "./_components/AgentEditorShell";

/* Route: /agents/:id (Agent Editor). Thin route entry — the shell (agent
 * list + editor), its styles and constants are colocated under
 * _components/AgentEditorShell. */
export default function AgentEditorPage() {
  return <AgentEditorShell />;
}
