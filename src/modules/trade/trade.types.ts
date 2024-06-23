import type { DModelSource } from '~/modules/llms/store-llms';

import type { DConversation, DConversationId } from '~/common/stores/chat/chat.conversation';
import type { DMessage } from '~/common/stores/chat/chat.message';
import { createTextContentFragment } from '~/common/stores/chat/chat.fragments';


/// STORED TYPES definitions ///
/// do not change(!) these - consider people's backups and stored data

export type ExportedAllJsonV1B = {
  conversations: ExportedChatJsonV1[];
  models: { sources: DModelSource[] };
  folders?: { folders: ExportedFolderJsonV1[]; enableFolders: boolean };
}

export type ExportedChatJsonV1 = {
  id: string;
  messages: (DMessage | ImportDMessageV3)[];
  systemPurposeId: string;
  userTitle?: string;
  autoTitle?: string;
  created: number;
  updated: number | null;
}

export type ExportedFolderJsonV1 = { // this is here to 'freeze' in time and cause typescript errors when we alter the real def
  id: string;
  title: string;
  conversationIds: DConversationId[];
  color?: string; // Optional color property
}


/**
 * This message type was before the May 2024 Multi-Part refactor.
 */
type ImportDMessageV3 = {
  id: string;
  text: string;
  sender: 'You' | 'Bot' | string;   // pretty name
  avatar: string | null;            // null, or image url
  typing: boolean;
  role: 'assistant' | 'system' | 'user';

  purposeId?: string;               // only assistant/system
  originLLM?: string;               // only assistant - model that generated this message, goes beyond known models

  metadata?: {                      // metadata, mainly at creation and for UI
    inReplyToText?: string;         // text this was in reply to
  };
  userFlags?: ('starred')[];             // (UI) user-set per-message flags

  tokenCount: number;               // cache for token count, using the current Conversation model (0 = not yet calculated)

  created: number;                  // created timestamp
  updated: number | null;           // updated timestamp
}


export function convertDMessageV3_to_V4(message: (DMessage | ImportDMessageV3)): DMessage {
  if (isDMessageV4(message))
    return message;
  const { text, typing, ...rest } = message;
  return {
    ...rest,
    fragments: [createTextContentFragment(text || '')],
  };
}

function isDMessageV4(message: DMessage | ImportDMessageV3): message is DMessage {
  return 'fragments' in message && Array.isArray(message.fragments);
}

// function isDMessageV3(message: DMessage | DMessageV3): message is DMessageV3 {
//   return 'text' in message;
// }


type ImportDConversationV3 = {
  id: string;
  messages: ImportDMessageV3[];
  systemPurposeId: string;
  userTitle?: string;
  autoTitle?: string;
  tokenCount: number;
  created: number;
  updated: number | null;
}

export function convertDConversation_V3_V4(conversation: (ImportDConversationV3 | DConversation)): DConversation {
  const { messages, systemPurposeId, ...rest } = conversation;
  return {
    ...rest,
    messages: messages.map(convertDMessageV3_to_V4),
    systemPurposeId: systemPurposeId as any,
    abortController: null,
  };
}
