import type { StoreApi } from 'zustand';
import { createStore as createVanillaStore, StateCreator } from 'zustand/vanilla';

import type { DLLMId } from '~/common/stores/llms/llms.types';
import type { DMessage, DMessageId } from '~/common/stores/chat/chat.message';
import type { DMessageFragment, DMessageFragmentId } from '~/common/stores/chat/chat.fragments';
import { getDiverseTopLlmIds } from '~/common/stores/llms/store-llms';

import { BeamConfigSnapshot, useModuleBeamStore } from './store-module-beam';
import { SCATTER_RAY_DEF } from './beam.config';
import { createGatherSlice, GatherStoreSlice, reInitGatherStateSlice } from './gather/beam.gather';
import { createScatterSlice, reInitScatterStateSlice, ScatterStoreSlice } from './scatter/beam.scatter';


/// Beam Store (vanilla, creator function) ///
// Uses the Slices pattern, described in: https://docs.pmnd.rs/zustand/guides/typescript#slices-pattern

export type BeamStore = RootStoreSlice & GatherStoreSlice & ScatterStoreSlice;

export const createBeamVanillaStore = (): StoreApi<BeamStore> => createVanillaStore<BeamStore>()((...a) => ({

  ...createRootSlice(...a),
  ...createScatterSlice(...a),
  ...createGatherSlice(...a),

}));


/// Common Store Slice ///

type BeamSuccessCallback = (messageUpdate: Pick<DMessage, 'fragments' | 'generator'>) => void;

interface RootStateSlice {

  isOpen: boolean;
  isEditMode: boolean;
  isMaximized: boolean;
  inputHistory: DMessage[] | null;
  inputIssues: string | null;
  inputReady: boolean;
  onSuccessCallback: BeamSuccessCallback | null;

}

const initRootStateSlice = (): RootStateSlice => ({

  isOpen: false,
  isEditMode: false,
  isMaximized: false,
  inputHistory: null,
  inputIssues: null,
  inputReady: false,
  onSuccessCallback: null,

});

export interface RootStoreSlice extends RootStateSlice {

  // lifecycle
  open: (chatHistory: Readonly<DMessage[]>, initialChatLlmId: DLLMId | null, isEditMode: boolean, callback: BeamSuccessCallback) => void;
  terminateKeepingSettings: () => void;
  loadBeamConfig: (preset: BeamConfigSnapshot | null) => void;

  setIsMaximized: (maximized: boolean) => void;
  inputHistoryReplaceMessageFragment: (messageId: DMessageId, fragmentId: DMessageFragmentId, newFragment: DMessageFragment) => void;

}


const createRootSlice: StateCreator<BeamStore, [], [], RootStoreSlice> = (_set, _get) => ({

  // init state
  ...initRootStateSlice(),


  open: (chatHistory: Readonly<DMessage[]>, initialChatLlmId: DLLMId | null, isEditMode: boolean, callback: BeamSuccessCallback) => {
    const { isOpen: wasAlreadyOpen, terminateKeepingSettings, loadBeamConfig, hadImportedRays, setRayLlmIds, setCurrentGatherLlmId } = _get();

    // reset pending operations
    terminateKeepingSettings();

    // validate history
    const history = [...chatHistory];
    const isValidHistory = history.length >= 1 && history[history.length - 1].role === 'user';

    // show and set input
    _set({
      // input
      isOpen: true,
      isEditMode,
      inputHistory: isValidHistory ? history : null,
      inputIssues: isValidHistory ? null : 'Invalid conversation history: missing user message',
      inputReady: isValidHistory,
      onSuccessCallback: callback,

      // rays already reset
      hadImportedRays,

      // update the model only if the dialog was not already open
      ...(!wasAlreadyOpen && initialChatLlmId && {
        currentGatherLlmId: initialChatLlmId,
      } satisfies Partial<GatherStoreSlice>),
    });

    // if not empty (recycle an existing open beam for this chat), we're done
    if (_get().rays.length)
      return;

    // if empty, initialize from the persisted config, if any
    loadBeamConfig(useModuleBeamStore.getState().lastConfig);
    if (_get().rays.length)
      return;

    // it no config (first-time): Heuristic: auto-pick the best models for the user, based on their ELO and variety
    const autoLlmIds = getDiverseTopLlmIds(SCATTER_RAY_DEF, true, initialChatLlmId);
    if (autoLlmIds.length > 0) {
      setRayLlmIds(autoLlmIds);
      setCurrentGatherLlmId(autoLlmIds[0]);
    }
  },

  terminateKeepingSettings: () =>
    _set(state => ({
      ...initRootStateSlice(),
      ...reInitScatterStateSlice(state.rays),
      ...reInitGatherStateSlice(state.fusions, state.currentGatherLlmId),  // remember after termination
    })),


  loadBeamConfig: (preset: BeamConfigSnapshot | null) => {
    if (preset) {
      const { setRayLlmIds, setCurrentGatherLlmId, setCurrentFactoryId } = _get();
      preset.rayLlmIds?.length && setRayLlmIds(preset.rayLlmIds);
      preset.gatherLlmId && setCurrentGatherLlmId(preset.gatherLlmId);
      preset.gatherFactoryId && setCurrentFactoryId(preset.gatherFactoryId);
    }
  },


  setIsMaximized: (maximized: boolean) =>
    _set({
      isMaximized: maximized,
    }),

  inputHistoryReplaceMessageFragment: (messageId: DMessageId, fragmentId: DMessageFragmentId, newFragment: DMessageFragment) =>
    _set(state => ({
      inputHistory: state.inputHistory?.map((message): DMessage => {
        if (message.id !== messageId)
          return message;

        // probably unnecessary development warning
        if (message.fragments.findIndex(f => f.fId === fragmentId) === -1) {
          console.error(`inputHistoryReplaceMessageFragment: cannot find missing fragment ID ${fragmentId} for message ${messageId}`);
          return message;
        }

        const updatedFragments = message.fragments.map((fragment) =>
          (fragment.fId === fragmentId)
            ? newFragment
            : fragment,
        );

        return {
          ...message,
          fragments: updatedFragments,
          updated: Date.now(),
        };
      }),
    })),

});

