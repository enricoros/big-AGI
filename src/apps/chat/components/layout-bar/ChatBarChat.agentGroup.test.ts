import assert from 'node:assert/strict';
import test from 'node:test';

import { createUniqueAgentName, getActiveAgentGroup, getAgentGroupSaveMode, getAgentSaveMode, getAssistantParticipantsSpeakWhenSummary, setAssistantParticipantsSpeakWhen } from './ChatBarChat.agentGroup';

test('resolves the currently active saved agent group', () => {
  const result = getActiveAgentGroup({
    activeConversationGroupId: 'group-active',
    savedAgentGroups: [
      { id: 'group-active', name: 'Research Squad' },
      { id: 'group-other', name: 'Writers' },
    ],
  });

  assert.deepStrictEqual(result, {
    id: 'group-active',
    name: 'Research Squad',
  });
});

test('keeps update mode when the draft name still matches the active saved group', () => {
  const result = getAgentGroupSaveMode({
    activeConversationGroupId: 'group-active',
    agentGroupNameDraft: 'Research Squad',
    savedAgentGroups: [
      { id: 'group-active', name: 'Research Squad' },
      { id: 'group-other', name: 'Writers' },
    ],
  });

  assert.deepStrictEqual(result, {
    buttonLabel: 'Update Group',
    existingId: 'group-active',
  });
});

test('switches to save mode when the draft name changes to a unique name', () => {
  const result = getAgentGroupSaveMode({
    activeConversationGroupId: 'group-active',
    agentGroupNameDraft: 'Research Squad v2',
    savedAgentGroups: [
      { id: 'group-active', name: 'Research Squad' },
      { id: 'group-other', name: 'Writers' },
    ],
  });

  assert.deepStrictEqual(result, {
    buttonLabel: 'Save Group',
    existingId: null,
  });
});

test('keeps update mode when the renamed draft collides with another saved group name', () => {
  const result = getAgentGroupSaveMode({
    activeConversationGroupId: 'group-active',
    agentGroupNameDraft: 'Writers',
    savedAgentGroups: [
      { id: 'group-active', name: 'Research Squad' },
      { id: 'group-other', name: 'Writers' },
    ],
  });

  assert.deepStrictEqual(result, {
    buttonLabel: 'Update Group',
    existingId: 'group-active',
  });
});

test('switches agent save mode to update when an agent with the same name already exists', () => {
  const result = getAgentSaveMode({
    participantName: 'Researcher',
    savedAgents: [
      { id: 'agent-1', name: 'Researcher' },
      { id: 'agent-2', name: 'Writer' },
    ],
  });

  assert.deepStrictEqual(result, {
    buttonLabel: 'Update Agent',
    existingId: 'agent-1',
  });
});

test('keeps agent save mode in save when the name is new', () => {
  const result = getAgentSaveMode({
    participantName: 'Analyst',
    savedAgents: [
      { id: 'agent-1', name: 'Researcher' },
    ],
  });

  assert.deepStrictEqual(result, {
    buttonLabel: 'Save Agent',
    existingId: null,
  });
});

test('creates a unique loaded agent name when the roster already contains the saved one', () => {
  const result = createUniqueAgentName('Researcher', ['Researcher', 'Reviewer']);

  assert.equal(result, 'Researcher 2');
});

test('bulk updates speakWhen for assistant participants only', () => {
  const human = {
    id: 'human-1',
    kind: 'human' as const,
    name: 'You',
  };
  const leader = {
    id: 'assistant-1',
    kind: 'assistant' as const,
    name: 'Leader',
    speakWhen: 'every-turn' as const,
    isLeader: true,
  };
  const reviewer = {
    id: 'assistant-2',
    kind: 'assistant' as const,
    name: 'Reviewer',
    speakWhen: 'when-mentioned' as const,
  };

  const result = setAssistantParticipantsSpeakWhen([human, leader, reviewer], 'when-mentioned');

  assert.strictEqual(result[0], human);
  assert.deepStrictEqual(result[1], {
    ...leader,
    speakWhen: 'when-mentioned',
  });
  assert.strictEqual(result[2], reviewer);
});

test('reuses the original array when all assistant participants already match the target mode', () => {
  const participants = [
    {
      id: 'human-1',
      kind: 'human' as const,
      name: 'You',
    },
    {
      id: 'assistant-1',
      kind: 'assistant' as const,
      name: 'Leader',
      speakWhen: 'every-turn' as const,
    },
  ];

  const result = setAssistantParticipantsSpeakWhen(participants, 'every-turn');

  assert.strictEqual(result, participants);
});

test('summarizes assistant speakWhen state when everyone is every turn', () => {
  const result = getAssistantParticipantsSpeakWhenSummary([
    { id: 'assistant-1', kind: 'assistant', name: 'Leader', speakWhen: 'every-turn' as const },
    { id: 'assistant-2', kind: 'assistant', name: 'Reviewer', speakWhen: 'every-turn' as const },
  ]);

  assert.deepStrictEqual(result, {
    key: 'every-turn',
    label: 'All: every turn',
  });
});

test('summarizes assistant speakWhen state when everyone is mention-only', () => {
  const result = getAssistantParticipantsSpeakWhenSummary([
    { id: 'assistant-1', kind: 'assistant', name: 'Leader', speakWhen: 'when-mentioned' as const },
    { id: 'assistant-2', kind: 'assistant', name: 'Reviewer', speakWhen: 'when-mentioned' as const },
  ]);

  assert.deepStrictEqual(result, {
    key: 'when-mentioned',
    label: 'All: only mention',
  });
});

test('summarizes assistant speakWhen state as mixed when the roster differs', () => {
  const result = getAssistantParticipantsSpeakWhenSummary([
    { id: 'assistant-1', kind: 'assistant', name: 'Leader', speakWhen: 'every-turn' as const },
    { id: 'assistant-2', kind: 'assistant', name: 'Reviewer', speakWhen: 'when-mentioned' as const },
  ]);

  assert.deepStrictEqual(result, {
    key: 'mixed',
    label: 'Mixed turns',
  });
});
