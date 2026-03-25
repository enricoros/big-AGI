import type { DConversationParticipant, DConversationParticipantSpeakWhen } from '~/common/stores/chat/chat.conversation';

type AgentGroupNameRef = {
  id: string;
  name: string;
};

type AgentNameRef = {
  id: string;
  name: string;
};

type ParticipantSpeakWhenRef = Pick<DConversationParticipant, 'kind' | 'speakWhen'>;

export function getAssistantParticipantsSpeakWhenSummary<T extends ParticipantSpeakWhenRef>(participants: readonly T[]): {
  key: 'every-turn' | 'when-mentioned' | 'mixed';
  label: string;
} {
  const assistantParticipants = participants.filter(participant => participant.kind === 'assistant');
  const everyTurnCount = assistantParticipants.filter(participant => (participant.speakWhen ?? 'every-turn') === 'every-turn').length;

  if (!assistantParticipants.length || everyTurnCount === assistantParticipants.length) {
    return {
      key: 'every-turn',
      label: 'All: every turn',
    };
  }

  if (everyTurnCount === 0) {
    return {
      key: 'when-mentioned',
      label: 'All: only mention',
    };
  }

  return {
    key: 'mixed',
    label: 'Mixed turns',
  };
}

export function getActiveAgentGroup<T extends AgentGroupNameRef>(params: {
  activeConversationGroupId: string | null;
  savedAgentGroups: readonly T[];
}): T | null {
  return params.activeConversationGroupId
    ? params.savedAgentGroups.find(group => group.id === params.activeConversationGroupId) ?? null
    : null;
}

function normalizeAgentGroupName(name: string): string {
  return name.trim().toLowerCase();
}

function normalizeAgentName(name: string): string {
  return name.trim().toLowerCase();
}

export function getAgentGroupSaveMode(params: {
  activeConversationGroupId: string | null;
  agentGroupNameDraft: string;
  savedAgentGroups: readonly AgentGroupNameRef[];
}): {
  buttonLabel: 'Save Group' | 'Update Group';
  existingId: string | null;
} {
  const activeGroup = getActiveAgentGroup(params);

  if (!activeGroup) {
    return {
      buttonLabel: 'Save Group',
      existingId: null,
    };
  }

  const normalizedDraftName = normalizeAgentGroupName(params.agentGroupNameDraft);
  const normalizedActiveName = normalizeAgentGroupName(activeGroup.name);
  const hasDifferentDraftName = normalizedDraftName !== normalizedActiveName;
  const matchesAnotherSavedGroup = params.savedAgentGroups.some(group =>
    group.id !== activeGroup.id && normalizeAgentGroupName(group.name) === normalizedDraftName,
  );

  return hasDifferentDraftName && !matchesAnotherSavedGroup
    ? {
      buttonLabel: 'Save Group',
      existingId: null,
    }
    : {
      buttonLabel: 'Update Group',
      existingId: activeGroup.id,
    };
}

export function getAgentSaveMode(params: {
  participantName: string;
  savedAgents: readonly AgentNameRef[];
}): {
  buttonLabel: 'Save Agent' | 'Update Agent';
  existingId: string | null;
} {
  const normalizedParticipantName = normalizeAgentName(params.participantName);
  const matchingAgent = params.savedAgents.find(agent => normalizeAgentName(agent.name) === normalizedParticipantName) ?? null;

  return matchingAgent
    ? {
        buttonLabel: 'Update Agent',
        existingId: matchingAgent.id,
      }
    : {
        buttonLabel: 'Save Agent',
        existingId: null,
      };
}

export function createUniqueAgentName(baseName: string, existingNames: readonly string[]): string {
  const trimmedBaseName = baseName.trim() || 'Agent';
  const normalizedExistingNames = new Set(existingNames.map(name => normalizeAgentName(name)).filter(Boolean));
  if (!normalizedExistingNames.has(normalizeAgentName(trimmedBaseName)))
    return trimmedBaseName;

  for (let suffix = 2; suffix < 100; suffix++) {
    const candidate = `${trimmedBaseName} ${suffix}`;
    if (!normalizedExistingNames.has(normalizeAgentName(candidate)))
      return candidate;
  }

  return `${trimmedBaseName} copy`;
}

export function setAssistantParticipantsSpeakWhen<T extends ParticipantSpeakWhenRef>(participants: readonly T[], speakWhen: DConversationParticipantSpeakWhen): T[] {
  let hasChanges = false;

  const nextParticipants = participants.map(participant => {
    if (participant.kind !== 'assistant' || (participant.speakWhen ?? 'every-turn') === speakWhen)
      return participant;

    hasChanges = true;
    return {
      ...participant,
      speakWhen,
    };
  });

  return hasChanges ? nextParticipants : participants as T[];
}
