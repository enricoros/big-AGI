import { createStore } from 'zustand/vanilla';
import { useStore } from 'zustand';

import type { DLLMId } from '~/modules/llms/store-llms';

import type { DMessage } from '~/common/state/store-chats';

import { ConversationHandler } from './ConversationHandler';


// Per-Beam Store

export interface BeamStore {

  isOpen: boolean;
  inputHistory: DMessage[] | null;
  configIssue: string | null;

  allLlmId: DLLMId | null;

  open: (history: DMessage[]) => void;
  close: () => void;


  setMergedLlmId: (llmId: DLLMId | null) => void;

}


export const createBeamStore = (initialLlmId: DLLMId | null) => createStore<BeamStore>()(
  (_set, _get) => ({

    isOpen: false,
    inputHistory: null,
    configIssue: null,
    allLlmId: initialLlmId,

    open: (history: DMessage[]) => {
      const isValidHistory = history.length > 0 && history[history.length - 1].role === 'user';
      _set({
        isOpen: true,
        inputHistory: isValidHistory ? history : null,
        configIssue: isValidHistory ? null : 'Invalid history',
      });
    },

    close: () => _get().isOpen && _set({ isOpen: false, inputHistory: null, configIssue: null }),

    setMergedLlmId: (llmId: DLLMId | null) => _set({ allLlmId: llmId }),

  }),
);


export const useBeamStore = <T, >(conversationHandler: ConversationHandler, selector: (store: BeamStore) => T): T =>
  useStore(conversationHandler.getBeamStore(), selector);
