import { createStore } from 'zustand/vanilla';

import type { DLLMId } from '~/modules/llms/store-llms';

import type { DMessage } from '~/common/state/store-chats';

import { BFusion, fusionGatherStop } from './beam.fusions';
import { BRay, BRayId, createBRay, rayIsScattering, rayIsSelectable, rayScatterStart, rayScatterStop } from './beam.rays';


// Beam

type BeamSuccessCallback = (text: string, llmId: DLLMId) => void;

interface BeamState {

  isOpen: boolean;
  isMaximized: boolean;
  inputHistory: DMessage[] | null;
  inputIssues: string | null;
  onSuccessCallback: BeamSuccessCallback | null;

  rays: BRay[];
  fusions: BFusion[];

  fusionLlmId: DLLMId | null; // i'd love to call this 'gatherLlmId', but it's already used too much and can hide errors

  readyScatter: boolean; // true if the input is valid
  readyGather: number;   // 0, or number of the rays that are ready to gather
  isScattering: boolean; // true if any ray is scattering at the moment
  isGathering: boolean;  // true if any fusion is gathering at the moment

}

const initialBeamState = (): BeamState => ({

  isOpen: false,
  isMaximized: false,
  inputHistory: null,
  inputIssues: null,
  onSuccessCallback: null,

  rays: [],
  fusions: [],

  fusionLlmId: null,

  readyScatter: false,
  readyGather: 0,
  isScattering: false,
  isGathering: false,

});

export interface BeamStore extends BeamState {

  // lifecycle
  open: (chatHistory: Readonly<DMessage[]>, initialLlmId: DLLMId | null, callback: BeamSuccessCallback) => void;
  terminate: () => void;

  setIsMaximized: (maximized: boolean) => void;
  editInputHistoryMessage: (messageId: string, newText: string) => void;

  // rays
  setRayCount: (count: number) => void;
  removeRay: (rayId: BRayId) => void;
  importRays: (messages: DMessage[]) => void;
  startScatteringAll: () => void;
  stopScatteringAll: () => void;
  rayToggleScattering: (rayId: BRayId) => void;
  raySetScatterLlmId: (rayId: BRayId, llmId: DLLMId | null) => void;
  _rayUpdate: (rayId: BRayId, update: Partial<BRay> | ((ray: BRay) => Partial<BRay>)) => void;

  // fusions
  setFusionLlmId: (llmId: DLLMId | null) => void;

  // state sync
  syncRaysStateToBeam: () => void;

}


export const createBeamStore = () => createStore<BeamStore>()(
  (_set, _get) => ({

    // state
    ...initialBeamState(),

    open: (chatHistory: Readonly<DMessage[]>, initialFusionLlmId: DLLMId | null, callback: BeamSuccessCallback) => {
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
        onSuccessCallback: callback,

        // rays already reset

        // gather
        ...((!wasOpen && initialFusionLlmId) && {
          // update the model only if the dialog was not already open
          fusionLlmId: initialFusionLlmId,
        }),

        // state
        readyScatter: isValidHistory,
      });
    },

    terminate: () => { /*_get().isOpen &&*/
      const { rays: prevRays, fusions: prevFusions, fusionLlmId } = _get();

      // Terminate all rays and fusions
      prevRays.forEach(rayScatterStop);
      prevFusions.forEach(fusionGatherStop);

      _set({
        ...initialBeamState(),

        // (remember after termination) models for each ray
        rays: prevRays.map((prevRay) => createBRay(prevRay.scatterLlmId)),
        // (remember after termination) gather model
        fusionLlmId,
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


    /// Rays ///

    setRayCount: (count: number) => {
      const { rays, syncRaysStateToBeam } = _get();
      if (count < rays.length) {
        // Terminate exceeding rays
        rays.slice(count).forEach(rayScatterStop);
        _set({
          rays: rays.slice(0, count),
        });
      } else if (count > rays.length) {
        _set({
          rays: [...rays, ...Array(count - rays.length).fill(null)
            // Create missing rays (unconfigured, unstarted)
            .map(() => createBRay(null)),
          ],
        });
      }
      syncRaysStateToBeam();
    },

    removeRay: (rayId: BRayId) => {
      _set(state => ({
        rays: state.rays.filter((ray) => {
          const shallStay = ray.rayId !== rayId;
          // Terminate the removed ray
          !shallStay && rayScatterStop(ray);
          return shallStay;
        }),
      }));
      _get().syncRaysStateToBeam();
    },

    importRays: (messages: DMessage[]) => {
      _set(state => ({
        rays: [
          // prepend the imported rays
          ...messages.map((message) => {
              const ray = createBRay(null);
              // pre-fill the ray status with the message and to a successful state
              if (message.text.trim()) {
                ray.status = 'success';
                ray.message.text = message.text;
                ray.message.updated = Date.now();
                ray.imported = true;
              }
              return ray;
            },
          ),
          // trim the back if too many empties
          ...state.rays.filter((ray) => ray.status !== 'empty'),
        ],
      }));
      _get().syncRaysStateToBeam();
    },


    setFusionLlmId: (llmId: DLLMId | null) =>
      _set({
        fusionLlmId: llmId,
      }),


    startScatteringAll: () => {
      _set(state => ({
        // Start all rays
        rays: state.rays.map(ray => rayScatterStart(ray, ray.scatterLlmId || state.fusionLlmId, false, _get())),
      }));
      _get().syncRaysStateToBeam();
    },

    stopScatteringAll: () =>
      _set(state => ({
        isScattering: false,
        // Terminate all rays
        rays: state.rays.map(rayScatterStop),
      })),

    rayToggleScattering: (rayId: BRayId) => {
      const { fusionLlmId, _rayUpdate, syncRaysStateToBeam } = _get();
      _rayUpdate(rayId, (ray) =>
        ray.status === 'scattering'
          ? /* User Terminated the ray */ rayScatterStop(ray)
          : /* User Started the ray */ rayScatterStart(ray, ray.scatterLlmId || fusionLlmId, false, _get()),
      );
      syncRaysStateToBeam();
    },

    raySetScatterLlmId: (rayId: BRayId, llmId: DLLMId | null) =>
      _get()._rayUpdate(rayId, {
        scatterLlmId: llmId,
      }),

    _rayUpdate: (rayId: BRayId, update: Partial<BRay> | ((ray: BRay) => Partial<BRay>)) => _set(state => ({
      rays: state.rays.map(ray => (ray.rayId === rayId)
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
