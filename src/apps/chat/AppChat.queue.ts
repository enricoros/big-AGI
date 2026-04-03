import type { DConversationTurnTerminationMode } from '~/common/stores/chat/chat.conversation';
import { messageFragmentsReduceText, type DMessageMetadata } from '~/common/stores/chat/chat.message';
import type { DMessageFragment } from '~/common/stores/chat/chat.fragments';

import type { ChatExecuteMode } from './execute-mode/execute-mode.types';


export type QueuedConversationSend = {
  mode: 'steer' | 'queue';
  chatExecuteMode: ChatExecuteMode;
  fragments: DMessageFragment[];
  metadata?: DMessageMetadata;
};

export type QueuedConversationPreview = {
  count: number;
  items: {
    index: number;
    label: string;
  }[];
  hasOverflow: boolean;
};

export type DrainQueuedConversationAction =
  | 'abort-active-and-process'
  | 'drop-missing-conversation'
  | 'process-next'
  | 'wait';

export type PostExecuteQueuedConversationAction =
  | 'drain'
  | 'hold';

function _truncateLabel(text: string, maxLength: number): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized)
    return '';
  return normalized.length <= maxLength
    ? normalized
    : `${normalized.slice(0, Math.max(maxLength - 1, 1)).trimEnd()}…`;
}

export function getQueuedConversationSendLabel(item: QueuedConversationSend, maxLength: number = 72): string {
  const text = _truncateLabel(messageFragmentsReduceText(item.fragments), maxLength);
  if (text)
    return text;

  switch (item.chatExecuteMode) {
    case 'append-user':
      return 'Append queued input';
    case 'beam-content':
      return 'Queued Beam run';
    case 'generate-image':
      return 'Queued image request';
    case 'react-content':
      return 'Queued ReAct request';
    case 'generate-content':
    default:
      return item.mode === 'steer' ? 'Queued priority message' : 'Queued message';
  }
}

export function getQueuedConversationPreview(
  queuedItems: QueuedConversationSend[],
  maxVisible: number = 3,
  maxLabelLength: number = 72,
): QueuedConversationPreview | null {
  if (!queuedItems.length)
    return null;

  const items = queuedItems
    .slice(0, maxVisible)
    .map((item, index) => ({
      index,
      label: getQueuedConversationSendLabel(item, maxLabelLength),
    }));

  return {
    count: queuedItems.length,
    items,
    hasOverflow: queuedItems.length > maxVisible,
  };
}

export function removeQueuedConversationSend(
  queuedItems: QueuedConversationSend[],
  removeIndex: number,
): QueuedConversationSend[] {
  if (removeIndex < 0 || removeIndex >= queuedItems.length)
    return queuedItems;

  return queuedItems.filter((_, index) => index !== removeIndex);
}

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

export function getQueuedConversationPostExecuteAction(params: {
  stopRequested: boolean;
}): PostExecuteQueuedConversationAction {
  return params.stopRequested ? 'hold' : 'drain';
}
