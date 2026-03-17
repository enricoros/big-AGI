import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';

import type { DConversationParticipant } from './chat.conversation';
import { useChatAgentGroupsStore } from './store-chat-agent-groups';


const humanParticipant: DConversationParticipant = {
  id: 'human-1',
  kind: 'human',
  name: 'You',
  personaId: null,
  llmId: null,
};

const assistantParticipant: DConversationParticipant = {
  id: 'assistant-1',
  kind: 'assistant',
  name: 'Architect',
  personaId: 'Developer',
  llmId: 'model-dev',
  speakWhen: 'when-mentioned',
};

const originalConsoleWarn = console.warn;

beforeEach(() => {
  console.warn = (...args: unknown[]) => {
    const firstArg = args[0];
    if (typeof firstArg === 'string' && firstArg.includes(`[zustand persist middleware] Unable to update item 'app-chat-agent-groups'`))
      return;
    originalConsoleWarn(...args);
  };
  useChatAgentGroupsStore.setState({ savedAgentGroups: [] });
});

afterEach(() => {
  console.warn = originalConsoleWarn;
});

test('saveAgentGroup normalizes the name and snapshots participants by value', () => {
  const store = useChatAgentGroupsStore.getState();
  const participants = [humanParticipant, assistantParticipant];

  const id = store.saveAgentGroup({
    name: '   ',
    systemPurposeId: 'Developer',
    turnTerminationMode: 'continuous',
    participants,
  });

  const savedGroup = useChatAgentGroupsStore.getState().savedAgentGroups[0];
  assert.equal(savedGroup?.id, id);
  assert.equal(savedGroup?.name, 'Untitled group');
  assert.equal(savedGroup?.turnTerminationMode, 'continuous');
  assert.notEqual(savedGroup?.participants, participants);
  assert.notEqual(savedGroup?.participants[1], participants[1]);

  participants[1].name = 'Mutated locally';
  assert.equal(savedGroup?.participants[1]?.name, 'Architect');
});

test('saveAgentGroup updates an existing group in place when an id is supplied', () => {
  const store = useChatAgentGroupsStore.getState();
  const originalId = store.saveAgentGroup({
    name: 'Crew',
    systemPurposeId: 'Generic',
    turnTerminationMode: 'round-robin-per-human',
    participants: [humanParticipant],
  });

  const initialUpdatedAt = useChatAgentGroupsStore.getState().savedAgentGroups[0]?.updatedAt ?? 0;

  store.saveAgentGroup({
    name: ' Crew Revised ',
    systemPurposeId: 'Designer',
    turnTerminationMode: 'continuous',
    participants: [humanParticipant, assistantParticipant],
  }, originalId);

  const savedGroups = useChatAgentGroupsStore.getState().savedAgentGroups;
  assert.equal(savedGroups.length, 1);
  assert.equal(savedGroups[0]?.id, originalId);
  assert.equal(savedGroups[0]?.name, 'Crew Revised');
  assert.equal(savedGroups[0]?.systemPurposeId, 'Designer');
  assert.equal(savedGroups[0]?.turnTerminationMode, 'continuous');
  assert.equal(savedGroups[0]?.participants.length, 2);
  assert.ok((savedGroups[0]?.updatedAt ?? 0) >= initialUpdatedAt);
});

test('renameAgentGroup preserves the existing name when given only whitespace and deleteAgentGroup removes it', () => {
  const store = useChatAgentGroupsStore.getState();
  const id = store.saveAgentGroup({
    name: 'Planning Cell',
    systemPurposeId: 'Generic',
    turnTerminationMode: 'round-robin-per-human',
    participants: [humanParticipant, assistantParticipant],
  });

  store.renameAgentGroup(id, '   ');
  assert.equal(useChatAgentGroupsStore.getState().savedAgentGroups[0]?.name, 'Planning Cell');

  store.renameAgentGroup(id, ' Delivery Cell ');
  assert.equal(useChatAgentGroupsStore.getState().savedAgentGroups[0]?.name, 'Delivery Cell');

  store.deleteAgentGroup(id);
  assert.deepEqual(useChatAgentGroupsStore.getState().savedAgentGroups, []);
});
