import type { DAgentSnapshot } from './store-chat-agent-groups';
import { humanReadableHyphenated } from '~/common/util/textUtils';

export type AgentTransferFile = {
  version: number;
  exportedAt: string;
  savedAgents: DAgentSnapshot[];
};

export type AgentImportMode = 'single' | 'all';

export const AGENTS_EXPORT_VERSION = 1;

export function buildAgentTransferFile(savedAgents: DAgentSnapshot[]): AgentTransferFile {
  return {
    version: AGENTS_EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    savedAgents,
  };
}

export function getAgentTransferFilename(args: {
  agentName?: string | null;
  exportedAtLabel: string;
}) {
  const normalizedAgentName = args.agentName?.trim();
  return normalizedAgentName
    ? `agent_${humanReadableHyphenated(normalizedAgentName)}_${args.exportedAtLabel}.json`
    : `agents_${args.exportedAtLabel}.json`;
}

export function parseAgentTransferFile(rawJson: string, mode: AgentImportMode): DAgentSnapshot[] {
  const parsed = JSON.parse(rawJson) as { savedAgents?: DAgentSnapshot[] };
  const importedSnapshots = Array.isArray(parsed.savedAgents)
    ? parsed.savedAgents.filter(agent =>
      !!agent
      && typeof agent.id === 'string'
      && typeof agent.name === 'string'
      && !!agent.participant
      && typeof agent.participant === 'object'
      && typeof agent.participant.id === 'string'
      && typeof agent.participant.kind === 'string'
      && typeof agent.participant.name === 'string'
      && typeof agent.participant.personaId === 'string')
    : [];

  if (!importedSnapshots.length)
    throw new Error('No valid agents found in the selected file.');

  if (mode === 'single' && importedSnapshots.length !== 1)
    throw new Error('Expected exactly 1 agent in the selected file.');

  return importedSnapshots;
}
