import type { DAgentGroupSnapshot } from './store-chat-agent-groups';
import { humanReadableHyphenated } from '~/common/util/textUtils';

export type AgentGroupTransferFile = {
  version: number;
  exportedAt: string;
  savedAgentGroups: DAgentGroupSnapshot[];
};

export type AgentGroupImportMode = 'single' | 'all';

export const AGENT_GROUPS_EXPORT_VERSION = 1;

export function buildAgentGroupTransferFile(savedAgentGroups: DAgentGroupSnapshot[]): AgentGroupTransferFile {
  return {
    version: AGENT_GROUPS_EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    savedAgentGroups,
  };
}

export function getAgentGroupTransferFilename(args: {
  groupName?: string | null;
  exportedAtLabel: string;
}) {
  const normalizedGroupName = args.groupName?.trim();
  return normalizedGroupName
    ? `agent-group_${humanReadableHyphenated(normalizedGroupName)}_${args.exportedAtLabel}.json`
    : `agent-groups_${args.exportedAtLabel}.json`;
}

export function parseAgentGroupTransferFile(rawJson: string, mode: AgentGroupImportMode): DAgentGroupSnapshot[] {
  const parsed = JSON.parse(rawJson) as { savedAgentGroups?: DAgentGroupSnapshot[] };
  const importedSnapshots = Array.isArray(parsed.savedAgentGroups)
    ? parsed.savedAgentGroups.filter(group =>
      !!group
      && typeof group.id === 'string'
      && typeof group.name === 'string'
      && typeof group.systemPurposeId === 'string'
      && typeof group.turnTerminationMode === 'string'
      && Array.isArray(group.participants),
    )
    : [];

  if (!importedSnapshots.length)
    throw new Error('No valid agent groups found in the selected file.');

  if (mode === 'single' && importedSnapshots.length !== 1)
    throw new Error('Expected exactly 1 agent group in the selected file.');

  return importedSnapshots;
}
