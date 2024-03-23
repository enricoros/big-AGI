import { createStore, StateCreator } from 'zustand/vanilla';

import type { DLLMId } from '~/modules/llms/store-llms';

import type { DMessage } from '~/common/state/store-chats';

import { createScatterSlice, reInitScatterStateSlice, ScatterStoreSlice } from './scatter/beam.scatter';
import { createGatherSlice, GatherStoreSlice, reInitGatherStateSlice } from './gather/beam.gather';


/// Beam Store (vanilla, creator function) ///
// Uses the Slices pattern, described in: https://docs.pmnd.rs/zustand/guides/typescript#slices-pattern

export type BeamStore = RootStoreSlice & GatherStoreSlice & ScatterStoreSlice;

export const createBeamVanillaStore = () => createStore<BeamStore>()((...a) => ({

  ...createRootSlice(...a),
  ...createScatterSlice(...a),
  ...createGatherSlice(...a),

}));


/// Common Store Slice ///

type BeamSuccessCallback = (text: string, llmId: DLLMId) => void;

interface RootStateSlice {

  isOpen: boolean;
  isMaximized: boolean;
  inputHistory: DMessage[] | null;
  inputIssues: string | null;
  inputReady: boolean;
  onSuccessCallback: BeamSuccessCallback | null;

}

const initRootStateSlice = (): RootStateSlice => ({

  isOpen: false,
  isMaximized: false,
  inputHistory: null,
  inputIssues: null,
  inputReady: false,
  onSuccessCallback: null,

});

export interface RootStoreSlice extends RootStateSlice {

  // lifecycle
  open: (chatHistory: Readonly<DMessage[]>, initialLlmId: DLLMId | null, callback: BeamSuccessCallback) => void;
  terminate: () => void;

  setIsMaximized: (maximized: boolean) => void;
  editInputHistoryMessage: (messageId: string, newText: string) => void;

}


const createRootSlice: StateCreator<BeamStore, [], [], RootStoreSlice> = (_set, _get) => ({

  // init state
  ...initRootStateSlice(),


  open: (chatHistory: Readonly<DMessage[]>, initialGatherLLMId: DLLMId | null, callback: BeamSuccessCallback) => {
    const { isOpen: wasOpen, terminate } = _get();

    // reset pending operations
    terminate();

    // validate history
    const history = [...chatHistory];
    const isValidHistory = history.length >= 1 && history[history.length - 1].role === 'user';
    _set({
      // input
      isOpen: true,
      inputHistory: isValidHistory ? history : null,
      inputIssues: isValidHistory ? null : 'Invalid history',
      inputReady: isValidHistory,
      onSuccessCallback: callback,

      // rays already reset

      // fusions
      ...((!wasOpen && initialGatherLLMId) && {
        // update the model only if the dialog was not already open
        gatherLlmId: initialGatherLLMId,
      }),
    });
  },

  terminate: () => { /*_get().isOpen &&*/
    const { rays, fusions, gatherLlmId } = _get();

    _set({
      ...initRootStateSlice(),
      ...reInitScatterStateSlice(rays),
      ...reInitGatherStateSlice(fusions),

      // remember after termination
      gatherLlmId,
    });
  },


  setIsMaximized: (maximized: boolean) =>
    _set({
      isMaximized: maximized,
    }),

  editInputHistoryMessage: (messageId: string, newText: string) =>
    _set(state => ({
      inputHistory: state.inputHistory?.map((message) => (message.id !== messageId) ? message : {
        ...message,
        text: newText,
      }),
    })),

});

