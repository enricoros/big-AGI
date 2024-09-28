import { defaultSystemPurposeId, SystemPurposeId } from '../../../data';

import { agiUuid } from '~/common/util/idUtils';

import { DMessage, DMessageId, duplicateDMessageNoPH } from './chat.message';


/// Conversation

export interface DConversation {
  id: DConversationId;                // unique identifier for this conversation

  messages: DMessage[];               // linear list of messages in this conversation

  // editable
  userTitle?: string;
  autoTitle?: string;
  userSymbol?: string;                // TODO: let the user customize this - there may be a mapping elsewhere, but this is small enough and will do for now

  // TODO: [x Head] - this should be the system purpose of current head of the conversation
  // there should be the concept of the audience of the current head
  systemPurposeId: SystemPurposeId;   // system purpose of this conversation

  // when updated is null, we don't have messages yet (timestamps as Date.now())
  created: number;                    // creation timestamp
  updated: number | null;             // last update timestamp

  // TODO: @deprecated - should be a view-related cache
  tokenCount: number;                 // f(messages, llmId)

  // Not persisted, used while in-memory, or temporarily by the UI
  // TODO: @deprecated - shouls not be in here - it's actually a per-message/operation thing
  _abortController: AbortController | null;

  // future additions:
  // draftUserMessage?: { text: string; attachments: any[] };
  // isMuted: boolean; isArchived: boolean; isStarred: boolean;
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

    // @deprecated
    systemPurposeId: systemPurposeId || defaultSystemPurposeId,
    // @deprecated
    tokenCount: 0,

    created: Date.now(),
    updated: Date.now(),

    _abortController: null,
  };
}

export function duplicateDConversationNoPH(conversation: DConversation, lastMessageId?: DMessageId): DConversation {

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
      .map(duplicateDMessageNoPH), // [*] duplicate conversation - see downstream

    // userTitle: conversation.userTitle, // undefined
    autoTitle: newTitle,
    userSymbol: conversation.userSymbol,

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
