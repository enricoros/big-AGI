import assert from 'node:assert/strict';
import test from 'node:test';
import * as storeModule from './store-chat-agent-groups';

if (!globalThis.localStorage) {
  const memoryStorage = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    value: {
      getItem: (key: string) => memoryStorage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        memoryStorage.set(key, value);
      },
      removeItem: (key: string) => {
        memoryStorage.delete(key);
      },
      clear: () => {
        memoryStorage.clear();
      },
      key: (index: number) => Array.from(memoryStorage.keys())[index] ?? null,
      get length() {
        return memoryStorage.size;
      },
    } satisfies Storage,
    configurable: true,
  });
}

const useChatAgentGroupsStore = (storeModule as typeof storeModule & {
  default?: { useChatAgentGroupsStore?: typeof storeModule.useChatAgentGroupsStore };
}).useChatAgentGroupsStore ?? storeModule.default?.useChatAgentGroupsStore;

if (!useChatAgentGroupsStore)
  throw new Error('Could not load useChatAgentGroupsStore for tests');

const resetStore = () => {
  useChatAgentGroupsStore.setState(useChatAgentGroupsStore.getInitialState(), true);
};

test('saves a single agent snapshot and normalizes the stored name', () => {
  resetStore();

  const savedId = useChatAgentGroupsStore.getState().saveAgent({
    name: '  Researcher  ',
    participant: {
      id: 'participant-1',
      kind: 'assistant',
      name: 'Original name',
      personaId: 'Default',
      llmId: 'openai-gpt-5.4-mini',
      speakWhen: 'every-turn',
    },
  });

  const savedAgents = useChatAgentGroupsStore.getState().savedAgents;
  assert.equal(savedAgents.length, 1);
  assert.equal(savedAgents[0]?.id, savedId);
  assert.equal(savedAgents[0]?.name, 'Researcher');
  assert.equal(savedAgents[0]?.participant.name, 'Researcher');
});

test('updates an existing saved agent in place when an id is provided', () => {
  resetStore();

  const savedId = useChatAgentGroupsStore.getState().saveAgent({
    name: 'Researcher',
    participant: {
      id: 'participant-1',
      kind: 'assistant',
      name: 'Researcher',
      personaId: 'Default',
      llmId: 'openai-gpt-5.4-mini',
      speakWhen: 'every-turn',
    },
  });

  useChatAgentGroupsStore.getState().saveAgent({
    name: 'Reviewer',
    participant: {
      id: 'participant-2',
      kind: 'assistant',
      name: 'Reviewer',
      personaId: 'Custom',
      llmId: null,
      speakWhen: 'when-mentioned',
    },
  }, savedId);

  const savedAgents = useChatAgentGroupsStore.getState().savedAgents;
  assert.equal(savedAgents.length, 1);
  assert.equal(savedAgents[0]?.id, savedId);
  assert.equal(savedAgents[0]?.name, 'Reviewer');
  assert.equal(savedAgents[0]?.participant.personaId, 'Custom');
  assert.equal(savedAgents[0]?.participant.speakWhen, 'when-mentioned');
});

test('renames and deletes saved agents', () => {
  resetStore();

  const savedId = useChatAgentGroupsStore.getState().saveAgent({
    name: 'Researcher',
    participant: {
      id: 'participant-1',
      kind: 'assistant',
      name: 'Researcher',
      personaId: 'Default',
      llmId: null,
      speakWhen: 'every-turn',
    },
  });

  useChatAgentGroupsStore.getState().renameAgent(savedId, 'Analyst');
  assert.equal(useChatAgentGroupsStore.getState().savedAgents[0]?.name, 'Analyst');
  assert.equal(useChatAgentGroupsStore.getState().savedAgents[0]?.participant.name, 'Analyst');

  useChatAgentGroupsStore.getState().deleteAgent(savedId);
  assert.deepStrictEqual(useChatAgentGroupsStore.getState().savedAgents, []);
});

test('migrates legacy consensus agent groups to council snapshots', () => {
  const migrated = storeModule.migratePersistedAgentGroupsState({
    savedAgentGroups: [{
      id: 'legacy-group',
      name: '  Legacy council  ',
      systemPurposeId: 'Developer',
      turnTerminationMode: 'consensus',
      consensusMaxRounds: '5',
      participants: [{
        id: 'participant-1',
        kind: 'assistant',
        name: 'Leader',
        personaId: 'Developer',
        llmId: 'openai-gpt-5.4-mini',
        speakWhen: 'every-turn',
      }],
      updatedAt: 123,
    }],
    savedAgents: [],
  }, 2);

  assert.deepStrictEqual(migrated?.savedAgentGroups, [{
    id: 'legacy-group',
    name: 'Legacy council',
    systemPurposeId: 'Developer',
    turnTerminationMode: 'council',
    councilMaxRounds: 5,
    councilTraceAutoCollapsePreviousRounds: true,
    councilTraceAutoExpandNewestRound: true,
    participants: [{
      id: 'participant-1',
      kind: 'assistant',
      name: 'Leader',
      personaId: 'Developer',
      llmId: 'openai-gpt-5.4-mini',
      speakWhen: 'every-turn',
    }],
    updatedAt: 123,
  }]);
});

test('saved agent groups normalize council trace preferences', () => {
  resetStore();

  const savedId = useChatAgentGroupsStore.getState().saveAgentGroup({
    name: 'Council group',
    systemPurposeId: 'Developer',
    turnTerminationMode: 'council',
    councilMaxRounds: 5,
    councilTraceAutoCollapsePreviousRounds: false,
    councilTraceAutoExpandNewestRound: false,
    participants: [{
      id: 'participant-1',
      kind: 'assistant',
      name: 'Leader',
      personaId: 'Developer',
      llmId: null,
      speakWhen: 'every-turn',
    }],
  });

  const savedGroup = useChatAgentGroupsStore.getState().savedAgentGroups.find(group => group.id === savedId);
  assert.equal(savedGroup?.councilTraceAutoCollapsePreviousRounds, false);
  assert.equal(savedGroup?.councilTraceAutoExpandNewestRound, false);
});
