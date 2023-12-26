import { create } from 'zustand';
import { createJSONStorage, devtools, persist } from 'zustand/middleware';
import { shallow } from 'zustand/shallow';
import { v4 as uuidv4 } from 'uuid';

import { DLLMId, useModelsStore } from '~/modules/llms/store-llms';
import { useFolderStore } from '~/common/state/store-folders';

import { countModelTokens } from '../util/token-counter';
import { defaultSystemPurposeId, SystemPurposeId } from '../../data';
import { IDB_MIGRATION_INITIAL, idbStateStorage } from '../util/idbUtils';


export type DConversationId = string;

/**
 * Conversation, a list of messages between humans and bots
 * Future:
 * - draftUserMessage?: { text: string; attachments: any[] };
 * - isMuted: boolean; isArchived: boolean; isStarred: boolean; participants: string[];
 */
export interface DConversation {
  id: DConversationId;
  messages: DMessage[];
  systemPurposeId: SystemPurposeId;
  userTitle?: string;
  autoTitle?: string;
  tokenCount: number;                 // f(messages, llmId)
  created: number;                    // created timestamp
  updated: number | null;             // updated timestamp
  // Not persisted, used while in-memory, or temporarily by the UI
  abortController: AbortController | null;
  ephemerals: DEphemeral[];
}

export function createDConversation(systemPurposeId?: SystemPurposeId): DConversation {
  return {
    id: uuidv4(),
    messages: [],
    systemPurposeId: systemPurposeId || defaultSystemPurposeId,
    tokenCount: 0,
    created: Date.now(),
    updated: Date.now(),
    abortController: null,
    ephemerals: [],
  };
}

const defaultConversations: DConversation[] = [createDConversation()];

/**
 * Message, sent or received, by humans or bots
 *
 * Other ideas:
 * - attachments?: {type: string; url: string; thumbnailUrl?: string; size?: number}[];
 * - isPinned?: boolean;
 * - reactions?: {type: string; count: number; users: string[]}[];
 * - status: 'sent' | 'delivered' | 'read' | 'failed';
 */
export interface DMessage {
  id: string;
  text: string;
  sender: 'You' | 'Bot' | string;   // pretty name
  avatar: string | null;            // null, or image url
  typing: boolean;
  role: 'assistant' | 'system' | 'user';

  purposeId?: SystemPurposeId;      // only assistant/system
  originLLM?: string;               // only assistant - model that generated this message, goes beyond known models

  tokenCount: number;               // cache for token count, using the current Conversation model (0 = not yet calculated)

  created: number;                  // created timestamp
  updated: number | null;           // updated timestamp
}

export function createDMessage(role: DMessage['role'], text: string): DMessage {
  return {
    id: uuidv4(),
    text,
    sender: role === 'user' ? 'You' : 'Bot',
    avatar: null,
    typing: false,
    role: role,
    tokenCount: 0,
    created: Date.now(),
    updated: null,
  };
}

/**
 * InterimStep, a place side-channel information is displayed
 */
export interface DEphemeral {
  id: string;
  title: string;
  text: string;
  state: object;
}

export function createDEphemeral(title: string, initialText: string): DEphemeral {
  return {
    id: uuidv4(),
    title: title,
    text: initialText,
    state: {},
  };
}


/// Conversations Store

interface ChatState {
  conversations: DConversation[];
}

interface ChatActions {
  // store setters
  prependNewConversation: (personaId: SystemPurposeId | undefined) => DConversationId;
  importConversation: (conversation: DConversation, preventClash: boolean) => DConversationId;
  branchConversation: (conversationId: DConversationId, messageId: string | null) => DConversationId | null;
  deleteConversation: (conversationId: DConversationId) => DConversationId | null;
  wipeAllConversations: (personaId: SystemPurposeId | undefined, folderId: string | null) => DConversationId;

  // within a conversation
  startTyping: (conversationId: string, abortController: AbortController | null) => void;
  stopTyping: (conversationId: string) => void;
  setMessages: (conversationId: string, messages: DMessage[]) => void;
  appendMessage: (conversationId: string, message: DMessage) => void;
  deleteMessage: (conversationId: string, messageId: string) => void;
  editMessage: (conversationId: string, messageId: string, updatedMessage: Partial<DMessage>, touch: boolean) => void;
  setSystemPurposeId: (conversationId: string, systemPurposeId: SystemPurposeId) => void;
  setAutoTitle: (conversationId: string, autoTitle: string) => void;
  setUserTitle: (conversationId: string, userTitle: string) => void;

  appendEphemeral: (conversationId: string, devTool: DEphemeral) => void;
  deleteEphemeral: (conversationId: string, ephemeralId: string) => void;
  updateEphemeralText: (conversationId: string, ephemeralId: string, text: string) => void;
  updateEphemeralState: (conversationId: string, ephemeralId: string, state: object) => void;

  // utility function
  _editConversation: (conversationId: string, update: Partial<DConversation> | ((conversation: DConversation) => Partial<DConversation>)) => void;
}

type ConversationsStore = ChatState & ChatActions;

export const useChatStore = create<ConversationsStore>()(devtools(
  persist(
    (_set, _get) => ({

      // default state
      conversations: defaultConversations,

      prependNewConversation: (personaId: SystemPurposeId | undefined): DConversationId => {
        const newConversation = createDConversation(personaId);

        _set(state => ({
          conversations: [
            newConversation,
            ...state.conversations,
          ],
        }));

        return newConversation.id;
      },

      importConversation: (conversation: DConversation, preventClash: boolean): DConversationId => {
        const { conversations } = _get();

        // if there's a clash, abort the former conversation, and optionally change the ID
        const existing = conversations.find(_c => _c.id === conversation.id);
        if (existing) {
          existing?.abortController?.abort();
          if (preventClash) {
            conversation.id = uuidv4();
            console.warn('Conversation ID clash, changing ID to', conversation.id);
          }
        }

        conversation.tokenCount = updateTokenCounts(conversation.messages, true, 'importConversation');

        _set({
          conversations: [
            conversation,
            ...conversations.filter(_c => _c.id !== conversation.id),
          ],
        });

        return conversation.id;
      },

      branchConversation: (conversationId: DConversationId, messageId: string | null): DConversationId | null => {
        const { conversations } = _get();
        const conversation = conversations.find(_c => _c.id === conversationId);
        if (!conversation)
          return null;

        // create a deep copy of the conversation
        const deepCopy: DConversation = JSON.parse(JSON.stringify(conversation));
        let messageIndex = deepCopy.messages.length; // By default, include all messages if messageId is null
        if (messageId !== null) {
          messageIndex = deepCopy.messages.findIndex(_m => _m.id === messageId);
          messageIndex = messageIndex >= 0 ? messageIndex + 1 : deepCopy.messages.length; // If message is found, include it
        }

        // title this branched chat differently
        const newTitle = getNextBranchTitle(conversationTitle(conversation));

        const branched: DConversation = {
          ...deepCopy,
          id: uuidv4(), // roll conversation ID
          messages: deepCopy.messages
            .slice(0, messageIndex)
            .map((message: DMessage): DMessage => ({
              ...message,
              id: uuidv4(), // roll message ID
              typing: false,
            })),
          updated: Date.now(),
          // Set the new title for the branched conversation
          autoTitle: newTitle,
          // reset ephemerals
          abortController: null,
          ephemerals: [],
          // TODO: set references to parent conversation & message?
        };

        _set({
          conversations: [
            branched,
            ...conversations,
          ],
        });

        return branched.id;
      },

      deleteConversation: (conversationId: DConversationId): DConversationId | null => {
        let { conversations } = _get();

        // abort pending requests on this conversation
        const cIndex = conversations.findIndex((conversation: DConversation): boolean => conversation.id === conversationId);
        if (cIndex >= 0)
          conversations[cIndex].abortController?.abort();

        // remove from the list
        conversations = conversations.filter(_c => _c.id !== conversationId);
        _set({
          conversations,
        });

        // return the next conversation Id in line, if valid
        return conversations.length
          ? conversations[(cIndex >= 0 && cIndex < conversations.length) ? cIndex : conversations.length - 1].id
          : null;
      },

      wipeAllConversations: (personaId: SystemPurposeId | undefined, folderId: string | null): DConversationId => {
        let { conversations } = _get();
      
        // If a folder is selected, only delete conversations in that folder
        if (folderId) {
          const folderStore = useFolderStore.getState();
          const folderConversations = folderStore.folders.find(folder => folder.id === folderId)?.conversationIds || [];
          conversations = conversations.filter(conversation => !folderConversations.includes(conversation.id));
      
          // Update the folder to remove the deleted conversation IDs
          // for each conversation in the folder call folderStore.removeConversationFromFolder
          folderConversations.forEach(conversationId => folderStore.removeConversationFromFolder(folderId, conversationId));

        } else {
          // abort any pending requests on all conversations
          conversations.forEach(conversation => conversation.abortController?.abort());
        }
      
        const conversation = createDConversation(personaId);
      
        _set({
          conversations: folderId ? conversations : [conversation],
        });
      
        return conversation.id;
      },
            


      // within a conversation

      _editConversation: (conversationId: string, update: Partial<DConversation> | ((conversation: DConversation) => Partial<DConversation>)) =>
        _set(state => ({
          conversations: state.conversations.map((conversation: DConversation): DConversation =>
            conversation.id === conversationId
              ? {
                ...conversation,
                ...(typeof update === 'function' ? update(conversation) : update),
              }
              : conversation),
        })),

      startTyping: (conversationId: string, abortController: AbortController | null) =>
        _get()._editConversation(conversationId, () =>
          ({
            abortController: abortController,
          })),

      stopTyping: (conversationId: string) =>
        _get()._editConversation(conversationId, conversation => {
          conversation.abortController?.abort();
          return {
            abortController: null,
          };
        }),

      setMessages: (conversationId: string, newMessages: DMessage[]) =>
        _get()._editConversation(conversationId, conversation => {
          conversation.abortController?.abort();
          return {
            messages: newMessages,
            ...(!!newMessages.length ? {} : {
              autoTitle: undefined,
            }),
            tokenCount: updateTokenCounts(newMessages, false, 'setMessages'),
            updated: Date.now(),
            abortController: null,
            ephemerals: [],
          };
        }),

      appendMessage: (conversationId: string, message: DMessage) =>
        _get()._editConversation(conversationId, conversation => {

          if (!message.typing)
            updateTokenCounts([message], true, 'appendMessage');

          const messages = [...conversation.messages, message];

          return {
            messages,
            tokenCount: messages.reduce((sum, message) => sum + 4 + message.tokenCount || 0, 3),
            updated: Date.now(),
          };
        }),

      deleteMessage: (conversationId: string, messageId: string) =>
        _get()._editConversation(conversationId, conversation => {

          const messages = conversation.messages.filter(message => message.id !== messageId);

          return {
            messages,
            tokenCount: messages.reduce((sum, message) => sum + 4 + message.tokenCount || 0, 3),
            updated: Date.now(),
          };
        }),

      editMessage: (conversationId: string, messageId: string, updatedMessage: Partial<DMessage>, setUpdated: boolean) =>
        _get()._editConversation(conversationId, conversation => {

          const chatLLMId = useModelsStore.getState().chatLLMId;
          const messages = conversation.messages.map((message: DMessage): DMessage =>
            message.id === messageId
              ? {
                ...message,
                ...updatedMessage,
                ...(setUpdated && { updated: Date.now() }),
                ...(((updatedMessage.typing === false || !message.typing) && chatLLMId && {
                  tokenCount: countModelTokens(updatedMessage.text || message.text, chatLLMId, 'editMessage(typing=false)'),
                })),
              }
              : message);

          return {
            messages,
            tokenCount: messages.reduce((sum, message) => sum + 4 + message.tokenCount || 0, 3),
            ...(setUpdated && { updated: Date.now() }),
          };
        }),

      setSystemPurposeId: (conversationId: string, systemPurposeId: SystemPurposeId) =>
        _get()._editConversation(conversationId,
          {
            systemPurposeId,
          }),

      setAutoTitle: (conversationId: string, autoTitle: string) =>
        _get()._editConversation(conversationId,
          {
            autoTitle,
          }),

      setUserTitle: (conversationId: string, userTitle: string) =>
        _get()._editConversation(conversationId,
          {
            userTitle,
          }),

      appendEphemeral: (conversationId: string, ephemeral: DEphemeral) =>
        _get()._editConversation(conversationId, conversation => {
          const ephemerals = [...conversation.ephemerals, ephemeral];
          return {
            ephemerals,
          };
        }),

      deleteEphemeral: (conversationId: string, ephemeralId: string) =>
        _get()._editConversation(conversationId, conversation => {
          const ephemerals = conversation.ephemerals?.filter((e: DEphemeral): boolean => e.id !== ephemeralId) || [];
          return {
            ephemerals,
          };
        }),

      updateEphemeralText: (conversationId: string, ephemeralId: string, text: string) =>
        _get()._editConversation(conversationId, conversation => {
          const ephemerals = conversation.ephemerals?.map((e: DEphemeral): DEphemeral =>
            e.id === ephemeralId
              ? { ...e, text }
              : e) || [];
          return {
            ephemerals,
          };
        }),

      updateEphemeralState: (conversationId: string, ephemeralId: string, state: object) =>
        _get()._editConversation(conversationId, conversation => {
          const ephemerals = conversation.ephemerals?.map((e: DEphemeral): DEphemeral =>
            e.id === ephemeralId
              ? { ...e, state: state }
              : e) || [];
          return {
            ephemerals,
          };
        }),

    }),
    {
      name: 'app-chats',
      /* Version history:
       *  - 1: [2023-03-18] App launch, single chat
       *  - 2: [2023-04-10] Multi-chat version - invalidating data to be sure
       *  - 3: [2023-09-19] Switch to IndexedDB - no data shape change,
       *                    but we swapped the backend (localStorage -> IndexedDB)
       */
      version: 3,
      storage: createJSONStorage(() => idbStateStorage),

      // Migrations
      migrate: (persistedState: unknown, fromVersion: number): ConversationsStore => {
        // -1 -> 3: migration loading from localStorage to IndexedDB
        if (fromVersion === IDB_MIGRATION_INITIAL)
          return _migrateLocalStorageData() as any;

        // other: just proceed
        return persistedState as any;
      },

      // Pre-Saving: remove transient properties
      partialize: (state) => ({
        ...state,
        conversations: state.conversations.map((conversation: DConversation) => {
          const {
            abortController, ephemerals,
            ...rest
          } = conversation;
          return rest;
        }),
      }),

      // Post-Loading: re-add transient properties and cleanup state
      onRehydrateStorage: () => (state) => {
        if (!state) return;

        // fixup state
        for (const conversation of (state.conversations || [])) {
          // reset the typing flag
          for (const message of conversation.messages)
            message.typing = false;

          // rehydrate the transient properties
          conversation.abortController = null;
          conversation.ephemerals = [];
        }
      },

    }),
  {
    name: 'AppChats',
    enabled: false,
  }),
);


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

/**
 * Returns the chats stored in the localStorage, and rename the key for
 * backup/data loss prevention purposes
 */
function _migrateLocalStorageData(): ChatState | {} {
  const key = 'app-chats';
  const value = localStorage.getItem(key);
  if (!value) return {};
  try {
    // parse the localStorage state
    const localStorageState = JSON.parse(value)?.state;

    // backup and delete the localStorage key
    const backupKey = `${key}-v2`;
    localStorage.setItem(backupKey, value);
    localStorage.removeItem(key);

    // match the state from localstorage
    return {
      conversations: localStorageState?.conversations ?? [],
    };
  } catch (error) {
    console.error('LocalStorage migration error', error);
    return {};
  }
}

/**
 * Convenience function to count the tokens in a DMessage object
 */
function updateDMessageTokenCount(message: DMessage, llmId: DLLMId | null, forceUpdate: boolean, debugFrom: string): number {
  if (forceUpdate || !message.tokenCount)
    message.tokenCount = llmId ? countModelTokens(message.text, llmId, debugFrom) : 0;
  return message.tokenCount;
}

/**
 * Convenience function to update a set of messages, using the current chatLLM
 */
function updateTokenCounts(messages: DMessage[], forceUpdate: boolean, debugFrom: string): number {
  const { chatLLMId } = useModelsStore.getState();
  return 3 + messages.reduce((sum, message) => 4 + updateDMessageTokenCount(message, chatLLMId, forceUpdate, debugFrom) + sum, 0);
}

export const getConversation = (conversationId: DConversationId | null): DConversation | null =>
  conversationId ? useChatStore.getState().conversations.find(_c => _c.id === conversationId) ?? null : null;

export const useConversation = (conversationId: DConversationId | null) => useChatStore(state => {
  const { conversations } = state;

  // this object will change if any sub-prop changes as well
  const conversation = conversationId ? conversations.find(_c => _c.id === conversationId) ?? null : null;
  const title = conversation ? conversationTitle(conversation) : null;
  const chatIdx = conversation ? conversations.findIndex(_c => _c.id === conversation.id) : -1;
  const isChatEmpty = conversation ? !conversation.messages.length : true;
  const areChatsEmpty = isChatEmpty && conversations.length < 2;
  const newConversationId: DConversationId | null = (conversations.length && !conversations[0].messages.length) ? conversations[0].id : null;

  return {
    title,
    chatIdx,
    isChatEmpty,
    areChatsEmpty,
    newConversationId,
    _remove_systemPurposeId: conversation?.systemPurposeId ?? null,
    prependNewConversation: state.prependNewConversation,
    branchConversation: state.branchConversation,
    deleteConversation: state.deleteConversation,
    wipeAllConversations: state.wipeAllConversations,
    setMessages: state.setMessages,
  };
}, shallow);

export const useConversationsByFolder = (folderId: string | null) => useChatStore(state => {
  if (folderId) {
    const { conversations } = state;
    const folder = useFolderStore.getState().folders.find(_f => _f.id === folderId);
    if (folder)
      return conversations.filter(_c => folder.conversationIds.includes(_c.id));
  }
  // return all conversations if all folder is selected
  return state.conversations;
}, shallow);
