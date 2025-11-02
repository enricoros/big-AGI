import { defaultSystemPurposeId, SystemPurposeId } from '../../../data';

import { agiUuid } from '~/common/util/idUtils';

import { DMessage, DMessageId, duplicateDMessage } from './chat.message';


/// Conversation

/**
 * Per-conversation cost and token metrics accumulator.
 * Tree-like structure: root totals + optional model breakdown.
 * Monotonic (only increases), forward-compatible, compact JSON.
 */
export interface DChatMetrics {
  // Root-level totals (sum of all operations)
  $c: number;        // total costs in cents
  tIn: number;       // total input tokens
  tOut: number;      // total output tokens

  // Optional breakdown by model (compact for JSON size)
  m?: {
    [llmId: string]: {
      $c: number;      // model total cost in cents
      tIn: number;     // model input tokens
      tOut: number;    // model output tokens
      n: number;       // usage count
    }
  };
}

export interface DConversation {
  id: DConversationId;                // unique identifier for this conversation

  messages: DMessage[];               // linear list of messages in this conversation

  // editable
  userTitle?: string;
  autoTitle?: string;

  isArchived?: boolean;               // TODO: this is too simple - convert to improved meta information - for now this will do

  // temp flags
  _isIncognito?: boolean;             // simple implementation: won't store this conversation (note: side effects should be evaluated, images seem to be gc'd correctly, but not sure if this is really incognito)
  userSymbol?: string;                // TODO: let the user customize this - there may be a mapping elsewhere, but this is small enough and will do for now

  // TODO: [x Head] - this should be the system purpose of current head of the conversation
  // there should be the concept of the audience of the current head
  systemPurposeId: SystemPurposeId;   // system purpose of this conversation

  // when updated is null, we don't have messages yet (timestamps as Date.now())
  created: number;                    // creation timestamp
  updated: number | null;             // last update timestamp

  // TODO: @deprecated - should be a view-related cache
  tokenCount: number;                 // f(messages, llmId)

  // Per-conversation cost accumulation (monotonic, not reset)
  metrics?: DChatMetrics;             // accumulated costs and token usage

  // Not persisted, used while in-memory, or temporarily by the UI
  // TODO: @deprecated - shouls not be in here - it's actually a per-message/operation thing
  _abortController: AbortController | null;

  // future additions:
  // draftUserMessage?: { text: string; attachments: any[] };
  // isMuted: boolean; isStarred: boolean;
  // participants: personaIds...[];
}

export type DConversationId = string;


// helpers - creation

export function createDConversation(systemPurposeId?: SystemPurposeId): DConversation {
  return {
    id: agiUuid('chat-dconversation'),

    messages: [],

    // absent
    // userTitle: undefined,
    // autoTitle: undefined,
    // userSymbol: undefined,
    // isArchived: undefined,

    // @deprecated
    systemPurposeId: systemPurposeId || defaultSystemPurposeId,
    // @deprecated
    tokenCount: 0,

    created: Date.now(),
    updated: Date.now(),

    _abortController: null,
  };
}

export function duplicateDConversation(conversation: DConversation, lastMessageId: undefined | DMessageId, skipVoid: boolean): DConversation {

  // cut short messages, if requested
  let messagesToKeep = conversation.messages.length; // By default, include all messages if messageId is null
  if (lastMessageId) {
    const messageIndex = conversation.messages.findIndex(_m => _m.id === lastMessageId);
    if (messageIndex >= 0)
      messagesToKeep = messageIndex + 1;
  }

  // auto-increment title (1)
  const newTitle = getNextBranchTitle(conversationTitle(conversation));

  return {
    id: agiUuid('chat-dconversation'),

    messages: conversation.messages
      .slice(0, messagesToKeep)
      .map(message => duplicateDMessage(message, skipVoid)), // [*] duplicate conversation - see downstream

    // userTitle: conversation.userTitle, // undefined
    autoTitle: newTitle,
    userSymbol: conversation.userSymbol,
    ...(conversation.isArchived !== undefined ? { isArchived: conversation.isArchived } : {}), // copy archival state if set

    systemPurposeId: conversation.systemPurposeId,
    tokenCount: conversation.tokenCount,

    created: conversation.created,
    updated: Date.now(),

    _abortController: null,
  };
}


// helpers - title

export const conversationTitle = (conversation: DConversation, fallback?: string): string =>
  conversation.userTitle || conversation.autoTitle || fallback || ''; // 👋💬🗨️

function getNextBranchTitle(currentTitle: string): string {
  const numberPrefixRegex = /^\((\d+)\)\s+/; // Regex to find "(number) " at the beginning of the title
  const match = currentTitle.match(numberPrefixRegex);

  if (match) {
    const number = parseInt(match[1], 10) + 1;
    return currentTitle.replace(numberPrefixRegex, `(${number}) `);
  } else
    return `(1) ${currentTitle}`;
}


// helpers - System Instruction

export function hasSystemMessageInHistory(chatHistory: Readonly<DMessage[]>): boolean {
  return !!chatHistory?.length && chatHistory[0].role === 'system';
}

export function isSystemMessageUserEdited(message: DMessage): boolean {
  // make it explicit that '.updated' is the key to check for
  return message.role === 'system' && !!message.updated;
}

export function splitSystemMessageFromHistory(chatHistory: Readonly<DMessage[]>): {
  chatSystemInstruction: DMessage | null,
  chatHistory: Readonly<DMessage[]>,
} {
  const chatSystemInstruction = hasSystemMessageInHistory(chatHistory) ? chatHistory[0] : null;
  return {
    chatSystemInstruction,
    chatHistory: chatSystemInstruction ? chatHistory.slice(1) : chatHistory,
  };
}

export function excludeSystemMessages(messages: Readonly<DMessage[]>, showAll?: boolean): Readonly<DMessage[]> {
  if (showAll) return messages;
  return messages.filter(_m => _m.role !== 'system');
}

export function remapMessagesSysToUsr(messages: Readonly<DMessage[]> | null): DMessage[] {
  return (messages || []).map(_m => _m.role === 'system' ? { ..._m, role: 'user' as const } : _m); // (MUST: [0] is the system message of the original chat) cast system chat messages to the user role
}


// helpers - Metrics Accumulation

/**
 * Accumulates message metrics into conversation totals.
 * Creates metrics if needed, updates root totals and optional model breakdown.
 * Monotonic accumulator (only increases).
 */
export function accumulateConversationMetrics(
  conversation: DConversation,
  messageCostCents: number | undefined,
  inputTokens: number | undefined,
  outputTokens: number | undefined,
  llmId: string | null,
): void {
  // Skip if no meaningful data to accumulate
  if (!messageCostCents && !inputTokens && !outputTokens)
    return;

  const costCents = messageCostCents || 0;
  const tIn = inputTokens || 0;
  const tOut = outputTokens || 0;

  // Initialize metrics if first time
  if (!conversation.metrics) {
    conversation.metrics = {
      $c: 0,
      tIn: 0,
      tOut: 0,
    };
  }

  // Update root totals (monotonic)
  conversation.metrics.$c += costCents;
  conversation.metrics.tIn += tIn;
  conversation.metrics.tOut += tOut;

  // Update model breakdown if llmId provided
  if (llmId) {
    if (!conversation.metrics.m)
      conversation.metrics.m = {};

    if (!conversation.metrics.m[llmId]) {
      conversation.metrics.m[llmId] = {
        $c: 0,
        tIn: 0,
        tOut: 0,
        n: 0,
      };
    }

    conversation.metrics.m[llmId].$c += costCents;
    conversation.metrics.m[llmId].tIn += tIn;
    conversation.metrics.m[llmId].tOut += tOut;
    conversation.metrics.m[llmId].n += 1;
  }
}
