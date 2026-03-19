import assert from 'node:assert/strict';
import test from 'node:test';

import { AGENTS_EXPORT_VERSION, buildAgentTransferFile, getAgentTransferFilename, parseAgentTransferFile } from './store-chat-agent.transfer';

const sampleAgent = {
  id: 'agent-1',
  name: 'Researcher',
  participant: {
    id: 'participant-1',
    kind: 'assistant',
    name: 'Researcher',
    personaId: 'Custom',
    llmId: 'openai-gpt-5.4-mini',
    customPrompt: 'Be contrarian',
    speakWhen: 'every-turn',
  },
  updatedAt: 123,
} as const;

test('builds a transfer envelope for exporting agents', () => {
  const result = buildAgentTransferFile([sampleAgent]);

  assert.equal(result.version, AGENTS_EXPORT_VERSION);
  assert.equal(result.savedAgents.length, 1);
  assert.equal(result.savedAgents[0]?.id, sampleAgent.id);
  assert.equal(typeof result.exportedAt, 'string');
});

test('builds an all-agents filename when no single agent is provided', () => {
  assert.equal(getAgentTransferFilename({
    exportedAtLabel: '2026-03-19_12-00-00',
  }), 'agents_2026-03-19_12-00-00.json');
});

test('builds a single-agent filename from the agent name', () => {
  assert.equal(getAgentTransferFilename({
    agentName: 'Researcher',
    exportedAtLabel: '2026-03-19_12-00-00',
  }), 'agent_researcher_2026-03-19_12-00-00.json');
});

test('parses exactly one agent in single mode', () => {
  const parsed = parseAgentTransferFile(JSON.stringify({
    savedAgents: [sampleAgent],
  }), 'single');

  assert.equal(parsed.length, 1);
  assert.equal(parsed[0]?.participant.customPrompt, sampleAgent.participant.customPrompt);
});

test('rejects multi-agent files in single mode', () => {
  assert.throws(() => parseAgentTransferFile(JSON.stringify({
    savedAgents: [sampleAgent, { ...sampleAgent, id: 'agent-2', name: 'Reviewer' }],
  }), 'single'), /Expected exactly 1 agent/);
});

test('rejects files without valid agents', () => {
  assert.throws(() => parseAgentTransferFile(JSON.stringify({
    savedAgents: [{ nope: true }],
  }), 'all'), /No valid agents found/);
});
