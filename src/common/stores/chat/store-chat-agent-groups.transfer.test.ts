import assert from 'node:assert/strict';
import test from 'node:test';

import { AGENT_GROUPS_EXPORT_VERSION, buildAgentGroupTransferFile, getAgentGroupTransferFilename, parseAgentGroupTransferFile } from './store-chat-agent-groups.transfer';

const sampleGroup = {
  id: 'group-1',
  name: 'Research Squad',
  systemPurposeId: 'Default',
  turnTerminationMode: 'round-robin-per-human',
  participants: [],
  updatedAt: 123,
} as const;

test('builds a transfer envelope for exporting agent groups', () => {
  const result = buildAgentGroupTransferFile([sampleGroup]);

  assert.equal(result.version, AGENT_GROUPS_EXPORT_VERSION);
  assert.equal(result.savedAgentGroups.length, 1);
  assert.equal(result.savedAgentGroups[0]?.id, sampleGroup.id);
  assert.equal(typeof result.exportedAt, 'string');
});

test('builds an all-groups filename when no single group is provided', () => {
  assert.equal(getAgentGroupTransferFilename({
    exportedAtLabel: '2026-03-17_12-00-00',
  }), 'agent-groups_2026-03-17_12-00-00.json');
});

test('builds a single-group filename from the group name', () => {
  assert.equal(getAgentGroupTransferFilename({
    groupName: 'Research Squad',
    exportedAtLabel: '2026-03-17_12-00-00',
  }), 'agent-group_research-squad_2026-03-17_12-00-00.json');
});

test('parses multiple groups in all mode', () => {
  const parsed = parseAgentGroupTransferFile(JSON.stringify({
    savedAgentGroups: [sampleGroup, { ...sampleGroup, id: 'group-2', name: 'Writers' }],
  }), 'all');

  assert.equal(parsed.length, 2);
});

test('parses exactly one group in single mode', () => {
  const parsed = parseAgentGroupTransferFile(JSON.stringify({
    savedAgentGroups: [sampleGroup],
  }), 'single');

  assert.equal(parsed.length, 1);
  assert.equal(parsed[0]?.id, sampleGroup.id);
});

test('rejects multi-group files in single mode', () => {
  assert.throws(() => parseAgentGroupTransferFile(JSON.stringify({
    savedAgentGroups: [sampleGroup, { ...sampleGroup, id: 'group-2' }],
  }), 'single'), /Expected exactly 1 agent group/);
});

test('rejects files without valid groups', () => {
  assert.throws(() => parseAgentGroupTransferFile(JSON.stringify({
    savedAgentGroups: [{ nope: true }],
  }), 'all'), /No valid agent groups found/);
});
