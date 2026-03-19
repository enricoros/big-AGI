import type { DConversationTurnTerminationMode } from '~/common/stores/chat/chat.conversation';
import type { DMessageMetadata } from '~/common/stores/chat/chat.message';
import type { DMessageFragment } from '~/common/stores/chat/chat.fragments';

import type { ChatExecuteMode } from './execute-mode/execute-mode.types';


export type QueuedConversationSend = {
  mode: 'steer' | 'queue';
  chatExecuteMode: ChatExecuteMode;
  fragments: DMessageFragment[];
  metadata?: DMessageMetadata;
};

export type DrainQueuedConversationAction =
  | 'abort-active-and-process'
  | 'drop-missing-conversation'
  | 'process-next'
  | 'wait';

export function enqueueConversationSend(params: {
  queuedItems: QueuedConversationSend[];
  sendMode: 'steer' | 'queue';
  turnTerminationMode: DConversationTurnTerminationMode;
  chatExecuteMode: ChatExecuteMode;
  fragments: DMessageFragment[];
  metadata?: DMessageMetadata;
}): QueuedConversationSend[] {
  const nextQueuedItem: QueuedConversationSend = {
    mode: params.sendMode === 'steer' && params.turnTerminationMode === 'council'
      ? 'queue'
      : params.sendMode,
    chatExecuteMode: params.chatExecuteMode,
    fragments: params.fragments,
    metadata: params.metadata,
  };

  if (nextQueuedItem.mode !== 'steer')
    return [...params.queuedItems, nextQueuedItem];

  const firstQueuedIndex = params.queuedItems.findIndex(item => item.mode === 'queue');
  const steerInsertIndex = firstQueuedIndex >= 0 ? firstQueuedIndex : params.queuedItems.length;
  return [
    ...params.queuedItems.slice(0, steerInsertIndex),
    nextQueuedItem,
    ...params.queuedItems.slice(steerInsertIndex),
  ];
}

export function getQueuedConversationDrainAction(params: {
  hasConversation: boolean;
  isBusy: boolean;
  turnTerminationMode: DConversationTurnTerminationMode;
  nextQueuedMode: 'steer' | 'queue' | null;
}): DrainQueuedConversationAction {
  if (!params.nextQueuedMode)
    return 'wait';

  if (!params.hasConversation)
    return 'drop-missing-conversation';

  if (!params.isBusy)
    return 'process-next';

  return params.nextQueuedMode === 'steer' && params.turnTerminationMode !== 'council'
    ? 'abort-active-and-process'
    : 'wait';
}
