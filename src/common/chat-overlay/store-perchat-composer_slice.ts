import type { StateCreator } from 'zustand/vanilla';

import type { ChatExecuteMode } from '../../apps/chat/execute-mode/execute-mode.types';
import type { DConversationTurnTerminationMode } from '~/common/stores/chat/chat.conversation';
import type { DMetaReferenceItem } from '~/common/stores/chat/chat.message';


/// Chat Overlay Store: per-chat overlay state ///

export type CouncilSessionStatus = 'idle' | 'running' | 'paused' | 'stopped' | 'interrupted' | 'completed';

export interface CouncilSessionState {
  status: CouncilSessionStatus;
  executeMode: ChatExecuteMode | null;
  mode: DConversationTurnTerminationMode | null;
  phaseId: string | null;
  passIndex: number | null;
  workflowState?: import('../../apps/chat/editors/_handleExecute.council').CouncilSessionState | null;
  canResume: boolean;
  interruptionReason: string | null;
  updatedAt: number | null;
}

export const createIdleCouncilSessionState = (): CouncilSessionState => ({
  status: 'idle',
  executeMode: null,
  mode: null,
  phaseId: null,
  passIndex: null,
  workflowState: null,
  canResume: false,
  interruptionReason: null,
  updatedAt: null,
});

interface ComposerOverlayState {

  // list of all the references that the composer is holding to, before sending them out in the next message
  inReferenceTo: DMetaReferenceItem[];

  // text requested externally for the composer (e.g. clicking an @mention in the chat)
  composerDraftText: string;

  // whether hidden council deliberation messages are shown in the transcript
  showCouncilDeliberation: boolean;

  // current council execution lifecycle for this chat
  councilSession: CouncilSessionState;

}

export interface ComposerOverlayStore extends ComposerOverlayState {

  addInReferenceTo: (item: DMetaReferenceItem) => void;
  removeInReferenceTo: (item: DMetaReferenceItem) => void;
  clearInReferenceTo: () => void;

  setComposerDraftText: (text: string) => void;
  appendComposerDraftText: (text: string) => void;
  clearComposerDraftText: () => void;

  setShowCouncilDeliberation: (show: boolean) => void;
  toggleShowCouncilDeliberation: () => void;

  setCouncilSession: (session: CouncilSessionState) => void;
  updateCouncilSession: (update: Partial<CouncilSessionState>) => void;
  resetCouncilSession: () => void;

}


/**
 * NOTE: the Composer state is managed primarily by the component, however there's some state that's:
 *  - associated with the chat (e.g. in-reference-to text)
 *  - persisted across chats
 *
 * This slice manages the in-reference-to text state, but there's also a sister slice that manages the attachment drafts.
 */
export const createComposerOverlayStoreSlice: StateCreator<ComposerOverlayStore, [], [], ComposerOverlayStore> = (_set, _get) => ({

  // init state
  inReferenceTo: [],
  composerDraftText: '',
  showCouncilDeliberation: false,
  councilSession: createIdleCouncilSessionState(),

  // actions
  addInReferenceTo: (item) => _set(state => ({
    inReferenceTo: [...state.inReferenceTo, item],
  })),

  removeInReferenceTo: (item) => _set(state => ({
    inReferenceTo: state.inReferenceTo.filter((i) => i !== item),
  })),

  clearInReferenceTo: () => _set({ inReferenceTo: [] }),

  setComposerDraftText: (text) => _set({ composerDraftText: text }),

  appendComposerDraftText: (text) => _set(state => ({
    composerDraftText: !text
      ? state.composerDraftText
      : state.composerDraftText
        ? `${state.composerDraftText}${/\s$/.test(state.composerDraftText) ? '' : ' '}${text}`
        : text,
  })),

  clearComposerDraftText: () => _set({ composerDraftText: '' }),

  setShowCouncilDeliberation: (show) => _set({ showCouncilDeliberation: show }),

  toggleShowCouncilDeliberation: () => _set(state => ({
    showCouncilDeliberation: !state.showCouncilDeliberation,
  })),

  setCouncilSession: (session) => _set({ councilSession: session }),

  updateCouncilSession: (update) => _set(state => ({
    councilSession: {
      ...state.councilSession,
      ...update,
      updatedAt: Date.now(),
    },
  })),

  resetCouncilSession: () => _set({ councilSession: createIdleCouncilSessionState() }),

});
