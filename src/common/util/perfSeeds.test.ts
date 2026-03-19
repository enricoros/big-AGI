import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createPerfSeedConversation,
  parsePerfSeedId,
  resolvePerfSeedFromSearch,
} from './perfSeeds';


test('parsePerfSeedId accepts known ids and rejects invalid values', () => {
  assert.equal(parsePerfSeedId('chat-long'), 'chat-long');
  assert.equal(parsePerfSeedId('council-long'), 'council-long');
  assert.equal(parsePerfSeedId(''), null);
  assert.equal(parsePerfSeedId('unknown-seed'), null);
  assert.equal(parsePerfSeedId(null), null);
});

test('resolvePerfSeedFromSearch only activates seeds when perf mode is enabled', () => {
  assert.equal(resolvePerfSeedFromSearch('?perfSeed=chat-long', false), null);
  assert.equal(resolvePerfSeedFromSearch('?perf=1&perfSeed=chat-long', true), 'chat-long');
  assert.equal(resolvePerfSeedFromSearch('?perf=1&perfSeed=council-long', true), 'council-long');
  assert.equal(resolvePerfSeedFromSearch('?perf=1&perfSeed=nope', true), null);
});

test('createPerfSeedConversation builds a dense long-form chat transcript', () => {
  const conversation = createPerfSeedConversation('chat-long');

  assert.equal(conversation.turnTerminationMode, 'round-robin-per-human');
  assert.equal(conversation.councilSession ?? null, null);
  assert.ok((conversation.messages?.length ?? 0) >= 120);
  assert.ok(conversation.messages.some(message => message.role === 'user'));
  assert.ok(conversation.messages.some(message => message.role === 'assistant'));
  assert.ok(conversation.messages.some(message => message.fragments.some(fragment => fragment.ft === 'void')));
  assert.ok(conversation.messages.some(message => message.fragments.some(fragment =>
    fragment.ft === 'content' && fragment.part.pt === 'tool_invocation')));
});

test('createPerfSeedConversation builds a resumable council transcript with multiple rounds and rejection reasons', () => {
  const conversation = createPerfSeedConversation('council-long');

  assert.equal(conversation.turnTerminationMode, 'council');
  assert.ok((conversation.participants?.filter(participant => participant.kind === 'assistant').length ?? 0) >= 4);
  assert.ok((conversation.messages?.length ?? 0) >= 80);
  assert.ok(conversation.messages.some(message => message.metadata?.council?.kind === 'deliberation'));
  assert.equal(conversation.councilSession?.canResume, true);
  assert.equal(conversation.councilSession?.mode, 'council');
  assert.equal(conversation.councilSession?.workflowState?.rounds.length, 5);
  assert.equal(conversation.councilSession?.workflowState?.rounds[4]?.ballots.length, 2);
  assert.deepEqual(
    conversation.councilSession?.workflowState?.rounds[4]?.sharedRejectionReasons.slice(-2),
    [
      'Tighten the migration order so the rollback path is explicit.',
      'Call out the cache invalidation blast radius and owner for each step.',
    ],
  );
  assert.equal(conversation.councilSession?.workflowState?.status, 'reviewing');
});
