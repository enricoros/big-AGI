import assert from 'node:assert/strict';
import test from 'node:test';

import type { CouncilTraceRenderItem } from './ChatMessageList.councilTrace';
import type { DMessage } from '~/common/stores/chat/chat.message';
import { createDMessageTextContent } from '~/common/stores/chat/chat.message';
import {
  countVisibleRenderEntryUnits,
  sliceVisibleRenderEntriesFromEnd,
  type GroupedVisibleRenderEntry,
  type VisibleRenderEntry,
} from './ChatMessageList.windowing';


function createMessageEntry(id: string): VisibleRenderEntry {
  const message = createDMessageTextContent('assistant', id);
  message.id = id;
  message.updated = message.created;

  return {
    kind: 'message',
    key: id,
    message,
    topDecoratorKind: undefined,
  };
}

function createTraceEntry(id: string): VisibleRenderEntry {
  return {
    kind: 'council-trace',
    key: id,
    trace: {
      phaseId: id,
      placement: { mode: 'after-phase', phaseId: id },
      rounds: [],
      reviewerCount: 3,
      totalRounds: 0,
      summaryStatus: 'reviewing',
    } satisfies CouncilTraceRenderItem,
  };
}

function createGroupEntry(id: string, messageCount: number): GroupedVisibleRenderEntry {
  const messages = Array.from({ length: messageCount }, (_, index) => {
    const message = createDMessageTextContent('assistant', `${id}-${index + 1}`);
    message.id = `${id}-${index + 1}`;
    message.updated = message.created;
    return message;
  });

  return {
    kind: 'group',
    key: id,
    label: id,
    passIndex: 0,
    messages,
    renderedMessages: messages.map((message, index) => ({
      message,
      topDecoratorKind: undefined,
      topDecoratorCompact: true as const,
      topDecoratorFirst: index === 0,
    })),
  };
}

test('countVisibleRenderEntryUnits counts grouped deliberation by message count', () => {
  assert.equal(countVisibleRenderEntryUnits(createMessageEntry('m-1')), 1);
  assert.equal(countVisibleRenderEntryUnits(createTraceEntry('trace-1')), 1);
  assert.equal(countVisibleRenderEntryUnits(createGroupEntry('group-1', 4)), 4);
});

test('sliceVisibleRenderEntriesFromEnd returns all entries when already within the limit', () => {
  const entries = [createMessageEntry('m-1'), createMessageEntry('m-2'), createTraceEntry('trace-1')];

  assert.deepEqual(sliceVisibleRenderEntriesFromEnd(entries, 3), entries);
  assert.deepEqual(sliceVisibleRenderEntriesFromEnd(entries, Infinity), entries);
});

test('sliceVisibleRenderEntriesFromEnd keeps the newest entries in order', () => {
  const entries = [
    createMessageEntry('m-1'),
    createMessageEntry('m-2'),
    createMessageEntry('m-3'),
    createMessageEntry('m-4'),
    createTraceEntry('trace-1'),
  ];

  const sliced = sliceVisibleRenderEntriesFromEnd(entries, 3);

  assert.deepEqual(sliced.map(entry => entry.key), ['m-3', 'm-4', 'trace-1']);
});

test('sliceVisibleRenderEntriesFromEnd counts grouped entries by contained messages', () => {
  const entries = [
    createMessageEntry('m-1'),
    createGroupEntry('group-1', 3),
    createMessageEntry('m-2'),
    createTraceEntry('trace-1'),
  ];

  const sliced = sliceVisibleRenderEntriesFromEnd(entries, 3);

  assert.deepEqual(sliced.map(entry => entry.key), ['m-2', 'trace-1']);
});

test('sliceVisibleRenderEntriesFromEnd always includes the newest entry even when it exceeds the limit', () => {
  const entries = [createGroupEntry('group-1', 12)];

  const sliced = sliceVisibleRenderEntriesFromEnd(entries, 4);

  assert.deepEqual(sliced.map(entry => entry.key), ['group-1']);
});

test('sliceVisibleRenderEntriesFromEnd keeps a before-message council trace attached to the final answer', () => {
  const resultEntry = createMessageEntry('result-1');
  const entries: VisibleRenderEntry[] = [
    createMessageEntry('m-1'),
    {
      kind: 'council-trace',
      key: 'trace-1',
      trace: {
        phaseId: 'phase-1',
        placement: { mode: 'before-message', anchorMessageId: 'result-1' },
        rounds: [],
        reviewerCount: 3,
        totalRounds: 1,
        summaryStatus: 'accepted',
      } satisfies CouncilTraceRenderItem,
    },
    resultEntry,
  ];

  const sliced = sliceVisibleRenderEntriesFromEnd(entries, 1);

  assert.deepEqual(sliced.map(entry => entry.key), ['trace-1', 'result-1']);
});
