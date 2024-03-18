import { v4 as uuidv4 } from 'uuid';
import { createStore } from 'zustand/vanilla';

import type { DLLMId } from '~/modules/llms/store-llms';

import { createDMessage, DMessage } from '~/common/state/store-chats';
import { createBRay, BRay, BRayId, rayIsScattering, rayIsSelectable, rayScatterStart, rayScatterStop } from '~/common/beam/beam.rays';


// configuration
const PLACEHOLDER_GATHER_TEXT = '📦 ...';


// Ray - each invidual thread of the beam


// Beam

type BeamSuccessCallback = (text: string, llmId: DLLMId) => void;

interface BeamState {

  isOpen: boolean;
  isMaximized: boolean;
  inputHistory: DMessage[] | null;
  inputIssues: string | null;
  onSuccessCallback: BeamSuccessCallback | null;

  rays: BRay[];

  gatherLlmId: DLLMId | null;
  gatherMessage: DMessage | null;
  gatherAbortController: AbortController | null;

  readyScatter: boolean; // true if the input is valid
  isScattering: boolean; // true if any ray is scattering at the moment

  readyGather: number;   // 0, or number of the rays that are ready to gather
  isGathering: boolean;

}

const initialBeamState = (): BeamState => ({

  isOpen: false,
  isMaximized: false,
  inputHistory: null,
  inputIssues: null,
  onSuccessCallback: null,

  rays: [],

  gatherLlmId: null,
  gatherMessage: null,
  gatherAbortController: null,

  readyScatter: false,
  isScattering: false,

  readyGather: 0,
  isGathering: false,

});

export interface BeamStore extends BeamState {

  open: (chatHistory: Readonly<DMessage[]>, initialLlmId: DLLMId | null, callback: BeamSuccessCallback) => void;
  terminate: () => void;

  setIsMaximized: (maximized: boolean) => void;
  editHistoryMessage: (messageId: string, newText: string) => void;

  setRayCount: (count: number) => void;
  removeRay: (rayId: BRayId) => void;
  importRays: (messages: DMessage[]) => void;

  setGatherLlmId: (llmId: DLLMId | null) => void;

  startScatteringAll: () => void;
  stopScatteringAll: () => void;
  toggleScattering: (rayId: BRayId) => void;
  toggleUserSelection: (rayId: BRayId) => void;
  setRayLlmId: (rayId: BRayId, llmId: DLLMId | null) => void;
  _updateRay: (rayId: BRayId, update: Partial<BRay> | ((ray: BRay) => Partial<BRay>)) => void;

  syncRaysStateToBeam: () => void;

}


export const createBeamStore = () => createStore<BeamStore>()(
  (_set, _get) => ({

    // internal
    debugId: uuidv4(),

    // state
    ...initialBeamState(),

    open: (chatHistory: Readonly<DMessage[]>, initialLlmId: DLLMId | null, callback: BeamSuccessCallback) => {
      const { isOpen: wasOpen, terminate } = _get();

      // reset pending operations
      terminate();

      // if just opened, update the model with the current chat model
      const gatherLlmId = !wasOpen && initialLlmId;

      // validate history
      const history = [...chatHistory];
      const isValidHistory = history.length >= 1 && history[history.length - 1].role === 'user';
      _set({
        // input
        isOpen: true,
        inputHistory: isValidHistory ? history : null,
        inputIssues: isValidHistory ? null : 'Invalid history',
        onSuccessCallback: callback,

        // rays already reset

        // gather
        ...(gatherLlmId ? { gatherLlmId: gatherLlmId } : {}),
        gatherMessage: isValidHistory ? createDMessage('assistant', PLACEHOLDER_GATHER_TEXT) : null,

        // state
        readyScatter: isValidHistory,
      });
    },

    terminate: () => { /*_get().isOpen &&*/
      const { rays: prevRays, gatherLlmId: prevGatherLlmId, gatherAbortController } = _get();

      // abort all rays and the gathermessage
      prevRays.forEach(rayScatterStop);
      gatherAbortController?.abort();

      _set({
        ...initialBeamState(),

        // remember some state between terminations
        rays: prevRays.map((prevRay) => createBRay(prevRay.scatterLlmId)),
        gatherLlmId: prevGatherLlmId,
      });
    },


    setIsMaximized: (maximized: boolean) => _set({
      isMaximized: maximized,
    }),

    editHistoryMessage: (messageId: string, newText: string) =>
      _set((state) => ({
        inputHistory: state.inputHistory?.map((message) => (message.id !== messageId) ? message : {
          ...message,
          text: newText,
        }),
      })),


    setRayCount: (count: number) => {
      const { rays, syncRaysStateToBeam } = _get();
      if (count < rays.length) {
        rays.slice(count).forEach(rayScatterStop);
        _set({
          rays: rays.slice(0, count),
        });
      } else if (count > rays.length) {
        _set({
          rays: [...rays, ...Array(count - rays.length).fill(null).map(() => createBRay(null))],
        });
      }
      syncRaysStateToBeam();
    },

    removeRay: (rayId: BRayId) => {
      const { syncRaysStateToBeam } = _get();
      _set((state) => ({
        rays: state.rays.filter((ray) => {
          if (ray.rayId === rayId) {
            rayScatterStop(ray);
            return false;
          }
          return true;
        }),
      }));
      syncRaysStateToBeam();
    },

    importRays: (messages: DMessage[]) => {
      const { rays, syncRaysStateToBeam } = _get();
      _set({
        rays: [
          ...messages.map((message) => {
              const ray = createBRay(null);
              if (message.text.trim()) {
                ray.status = 'success';
                ray.message.text = message.text;
                ray.message.updated = Date.now();
                ray.imported = true;
              }
              return ray;
            },
          ),
          ...rays.filter((ray) => ray.status !== 'empty'),
        ],
      });
      syncRaysStateToBeam();
    },


    setGatherLlmId: (llmId: DLLMId | null) => _set({
      gatherLlmId: llmId,
    }),


    startScatteringAll: () => {
      const { rays, syncRaysStateToBeam } = _get();
      _set({
        rays: rays.map(ray => rayScatterStart(ray, false, _get())),
      });
      // always need to invoke syncRaysStateToBeam after rayScatterStart
      syncRaysStateToBeam();
    },

    stopScatteringAll: () => {
      const { rays } = _get();
      _set({
        isScattering: false,
        rays: rays.map(ray => rayScatterStop(ray)),
      });
    },

    toggleScattering: (rayId: BRayId) => {
      const { rays, syncRaysStateToBeam } = _get();
      _set({
        rays: rays.map((ray) => (ray.rayId === rayId)
          ? (ray.status === 'scattering' ? rayScatterStop(ray) : rayScatterStart(ray, false, _get()))
          : ray,
        ),
      });
      // always need to invoke syncRaysStateToBeam after rayScatterStart
      syncRaysStateToBeam();
    },

    toggleUserSelection: (rayId: BRayId) => _set((state) => ({
      rays: state.rays.map((ray) => (ray.rayId === rayId)
        ? { ...ray, userSelected: !ray.userSelected }
        : ray,
      ),
    })),

    setRayLlmId: (rayId: BRayId, llmId: DLLMId | null) => _set((state) => ({
      rays: state.rays.map((ray) => (ray.rayId === rayId)
        ? { ...ray, scatterLlmId: llmId }
        : ray,
      ),
    })),


    _updateRay: (rayId: BRayId, update: Partial<BRay> | ((ray: BRay) => Partial<BRay>)) => _set((state) => ({
      rays: state.rays.map((ray) => (ray.rayId === rayId)
        ? { ...ray, ...(typeof update === 'function' ? update(ray) : update) }
        : ray,
      ),
    })),


    syncRaysStateToBeam: () => {
      const { rays } = _get();

      // Check if all rays have finished generating
      const hasRays = rays.length > 0;
      const allDone = !rays.some(rayIsScattering);
      const raysReady = rays.filter(rayIsSelectable).length;

      console.log('syncRaysStateToBeam', { count: rays.length, isScattering: hasRays && !allDone, allDone, raysReady });

      _set({
        isScattering: hasRays && !allDone,
        readyGather: raysReady,
      });
    },

  }),
);
