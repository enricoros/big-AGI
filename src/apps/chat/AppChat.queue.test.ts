import assert from 'node:assert/strict';
import test from 'node:test';

import { createTextContentFragment } from '~/common/stores/chat/chat.fragments';
import type { DConversationTurnTerminationMode } from '~/common/stores/chat/chat.conversation';
import type { ChatExecuteMode } from './execute-mode/execute-mode.types';

import {
  enqueueConversationSend,
  getQueuedConversationPreview,
  getQueuedConversationDrainAction,
  getQueuedConversationPostExecuteAction,
  removeQueuedConversationSend,
  type QueuedConversationSend,
} from './AppChat.queue';


const CHAT_EXECUTE_MODES: ChatExecuteMode[] = [
  'append-user',
  'beam-content',
  'generate-content',
  'generate-image',
  'react-content',
];

const TURN_TERMINATION_MODES: DConversationTurnTerminationMode[] = [
  'round-robin-per-human',
  'continuous',
  'council',
];

function createQueuedItem(mode: 'steer' | 'queue', chatExecuteMode: ChatExecuteMode, text: string): QueuedConversationSend {
  return {
    mode,
    chatExecuteMode,
    fragments: [createTextContentFragment(text)],
    metadata: {
      ephemeral: text,
    },
  };
}

test('enqueueConversationSend preserves every execute mode and inserts steer ahead of queued sends outside council', async (t) => {
  for (const turnTerminationMode of TURN_TERMINATION_MODES) {
    for (const chatExecuteMode of CHAT_EXECUTE_MODES) {
      await t.test(`${turnTerminationMode} / ${chatExecuteMode}`, () => {
        const queuedItems = [
          createQueuedItem('steer', 'generate-content', 'existing-steer'),
          createQueuedItem('queue', 'generate-content', 'existing-queue-a'),
          createQueuedItem('queue', 'react-content', 'existing-queue-b'),
        ];

        const result = enqueueConversationSend({
          queuedItems,
          sendMode: 'steer',
          turnTerminationMode,
          chatExecuteMode,
          fragments: [createTextContentFragment(`draft-${turnTerminationMode}-${chatExecuteMode}`)],
          metadata: { ephemeral: `${turnTerminationMode}-${chatExecuteMode}` },
        });

        if (turnTerminationMode === 'council') {
          assert.deepEqual(result.map(item => item.mode), ['steer', 'queue', 'queue', 'queue']);
        } else {
          assert.deepEqual(result.map(item => item.mode), ['steer', 'steer', 'queue', 'queue']);
        }

        const inserted = result[turnTerminationMode === 'council' ? 3 : 1];
        assert.equal(inserted.chatExecuteMode, chatExecuteMode);
        assert.equal(inserted.metadata?.ephemeral, `${turnTerminationMode}-${chatExecuteMode}`);
      });
    }
  }
});

test('enqueueConversationSend appends queued sends for every turn mode and execute mode', async (t) => {
  for (const turnTerminationMode of TURN_TERMINATION_MODES) {
    for (const chatExecuteMode of CHAT_EXECUTE_MODES) {
      await t.test(`${turnTerminationMode} / ${chatExecuteMode}`, () => {
        const queuedItems = [
          createQueuedItem('steer', 'generate-content', 'existing-steer'),
          createQueuedItem('queue', 'generate-content', 'existing-queue'),
        ];

        const result = enqueueConversationSend({
          queuedItems,
          sendMode: 'queue',
          turnTerminationMode,
          chatExecuteMode,
          fragments: [createTextContentFragment(`queued-${chatExecuteMode}`)],
          metadata: { ephemeral: chatExecuteMode },
        });

        assert.deepEqual(result.map(item => item.mode), ['steer', 'queue', 'queue']);
        const appended = result[2];
        assert.equal(appended.chatExecuteMode, chatExecuteMode);
        assert.equal(appended.metadata?.ephemeral, chatExecuteMode);
      });
    }
  }
});

test('getQueuedConversationDrainAction aborts only steer sends on busy non-council turns and otherwise waits or processes', async (t) => {
  const cases = [
    {
      title: 'drops queued item when the conversation disappeared',
      input: { hasConversation: false, isBusy: false, turnTerminationMode: 'round-robin-per-human' as const, nextQueuedMode: 'queue' as const },
      expected: 'drop-missing-conversation',
    },
    {
      title: 'processes queued item immediately when idle',
      input: { hasConversation: true, isBusy: false, turnTerminationMode: 'continuous' as const, nextQueuedMode: 'queue' as const },
      expected: 'process-next',
    },
    {
      title: 'waits for queued sends while busy',
      input: { hasConversation: true, isBusy: true, turnTerminationMode: 'round-robin-per-human' as const, nextQueuedMode: 'queue' as const },
      expected: 'wait',
    },
    {
      title: 'aborts the active turn for steer in non-council modes',
      input: { hasConversation: true, isBusy: true, turnTerminationMode: 'continuous' as const, nextQueuedMode: 'steer' as const },
      expected: 'abort-active-and-process',
    },
    {
      title: 'waits for steer in council because council cannot be interrupted mid-round',
      input: { hasConversation: true, isBusy: true, turnTerminationMode: 'council' as const, nextQueuedMode: 'steer' as const },
      expected: 'wait',
    },
    {
      title: 'waits when there is no queued item',
      input: { hasConversation: true, isBusy: true, turnTerminationMode: 'council' as const, nextQueuedMode: null },
      expected: 'wait',
    },
  ] as const;

  for (const { title, input, expected } of cases) {
    await t.test(title, () => {
      assert.equal(getQueuedConversationDrainAction(input), expected);
    });
  }
});

test('getQueuedConversationPreview shows queued text previews and overflow count', () => {
  const preview = getQueuedConversationPreview([
    createQueuedItem('steer', 'generate-content', 'First queued reply'),
    createQueuedItem('queue', 'generate-content', 'Second queued reply'),
    createQueuedItem('queue', 'react-content', 'Third queued reply'),
    createQueuedItem('queue', 'beam-content', 'Fourth queued reply'),
  ]);

  assert.deepEqual(preview, {
    count: 4,
    items: [
      { index: 0, label: 'First queued reply' },
      { index: 1, label: 'Second queued reply' },
      { index: 2, label: 'Third queued reply' },
    ],
    hasOverflow: true,
  });
});

test('getQueuedConversationPreview falls back to execute-mode labels when the queued item has no text', () => {
  const preview = getQueuedConversationPreview([{
    mode: 'queue',
    chatExecuteMode: 'generate-image',
    fragments: [],
  }]);

  assert.deepEqual(preview, {
    count: 1,
    items: [{ index: 0, label: 'Queued image request' }],
    hasOverflow: false,
  });
});

test('removeQueuedConversationSend removes the requested queued item by index', () => {
  const result = removeQueuedConversationSend([
    createQueuedItem('steer', 'generate-content', 'First queued reply'),
    createQueuedItem('queue', 'generate-content', 'Second queued reply'),
    createQueuedItem('queue', 'react-content', 'Third queued reply'),
  ], 1);

  assert.deepEqual(result.map(item => item.fragments[0] && 'part' in item.fragments[0] && item.fragments[0].part.pt === 'text' ? item.fragments[0].part.text : null), [
    'First queued reply',
    'Third queued reply',
  ]);
});

test('getQueuedConversationPostExecuteAction holds queued sends after an explicit stop request', () => {
  assert.equal(getQueuedConversationPostExecuteAction({ stopRequested: true }), 'hold');
  assert.equal(getQueuedConversationPostExecuteAction({ stopRequested: false }), 'drain');
});
