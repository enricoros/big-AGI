import { v4 as uuidv4 } from 'uuid';
import { createStore } from 'zustand/vanilla';
import { type StoreApi, useStore } from 'zustand';

import { streamAssistantMessage } from '../../apps/chat/editors/chat-stream';

import type { DLLMId } from '~/modules/llms/store-llms';

import { createDMessage, DMessage } from '~/common/state/store-chats';


// configuration
const PLACEHOLDER_SCATTER_TEXT = '💫 Generating ...'; // 💫 ..., 🖊️ ...
const PLACEHOLDER_GATHER_TEXT = '📦 ...';


// Ray - each invidual thread of the beam

type DRayId = string;

interface DRay {
  rayId: DRayId;
  status: 'empty' | 'scattering' | 'success' | 'stopped' | 'error';
  message: DMessage;
  scatterLlmId: DLLMId | null;
  scatterIssue?: string;
  genAbortController?: AbortController;
  userSelected: boolean;
}

function createDRay(scatterLlmId: DLLMId | null): DRay {
  return {
    rayId: uuidv4(),
    status: 'empty',
    message: createDMessage('assistant', ''),
    scatterLlmId,
    userSelected: false,
  };
}

function rayScatterStart(ray: DRay, onlyIdle: boolean, beamStore: BeamStore): DRay {
  if (ray.genAbortController)
    return ray;
  if (onlyIdle && ray.status !== 'empty')
    return ray;

  const { gatherLlmId, inputHistory, rays, updateRay, syncRaysStateToBeam } = beamStore;

  // validate model
  const rayLlmId = ray.scatterLlmId || gatherLlmId;
  if (!rayLlmId)
    return { ...ray, scatterIssue: 'No model selected' };

  // validate history
  if (!inputHistory || inputHistory.length < 1 || inputHistory[inputHistory.length - 1].role !== 'user')
    return { ...ray, scatterIssue: `Invalid conversation history (${inputHistory?.length})` };

  const abortController = new AbortController();

  const updateMessage = (update: Partial<DMessage>) => updateRay(ray.rayId, (ray) => ({
    ...ray,
    message: {
      ...ray.message,
      ...update,
      updated: Date.now(),
    },
  }));

  // stream the assistant's messages
  streamAssistantMessage(rayLlmId, inputHistory, rays.length, 'off', updateMessage, abortController.signal)
    .then((outcome) => {
      updateRay(ray.rayId, {
        status: (outcome === 'success') ? 'success' : (outcome === 'aborted') ? 'stopped' : (outcome === 'errored') ? 'error' : 'empty',
        genAbortController: undefined,
      });
    })
    .catch((error) => {
      updateRay(ray.rayId, {
        status: 'error',
        scatterIssue: error?.message || error?.toString() || 'Unknown error',
        genAbortController: undefined,
      });
    })
    .finally(() => {
      syncRaysStateToBeam();
    });

  return {
    rayId: ray.rayId,
    status: 'scattering',
    message: {
      ...ray.message,
      text: PLACEHOLDER_SCATTER_TEXT,
      updated: Date.now(),
    },
    scatterLlmId: rayLlmId,
    scatterIssue: undefined,
    genAbortController: abortController,
    userSelected: false,
  };
}

function rayScatterStop(ray: DRay): DRay {
  ray.genAbortController?.abort();
  return {
    ...ray,
    ...(ray.status === 'scattering' ? { status: 'stopped' } : {}),
    genAbortController: undefined,
  };
}

export function rayIsError(ray: DRay | null): boolean {
  return ray?.status === 'error';
}

export function rayIsScattering(ray: DRay | null): boolean {
  return ray?.status === 'scattering';
}

export function rayIsSelectable(ray: DRay | null): boolean {
  return !!ray?.message && !!ray.message.updated && !!ray.message.text && ray.message.text !== PLACEHOLDER_SCATTER_TEXT;
}

export function rayIsUserSelected(ray: DRay | null): boolean {
  return !!ray?.userSelected;
}


// Beam

interface BeamState {

  isOpen: boolean;
  inputHistory: DMessage[] | null;
  inputIssues: string | null;

  gatherLlmId: DLLMId | null;
  gatherMessage: DMessage | null;
  gatherAbortController: AbortController | null;

  rays: DRay[];

  readyScatter: boolean;
  isScattering: boolean;
  readyGather: boolean;
  isGathering: boolean;

}

interface BeamStore extends BeamState {

  open: (history: DMessage[], inheritLlmId: DLLMId | null) => void;
  close: () => void;

  setGatherLlmId: (llmId: DLLMId | null) => void;
  setRayCount: (count: number) => void;

  startScatteringAll: () => void;
  stopScatteringAll: () => void;
  toggleScattering: (rayId: DRayId) => void;
  toggleUserSelection: (rayId: DRayId) => void;
  removeRay: (rayId: DRayId) => void;
  updateRay: (rayId: DRayId, update: Partial<DRay> | ((ray: DRay) => Partial<DRay>)) => void;

  syncRaysStateToBeam: () => void;

}

export type BeamStoreApi = Readonly<StoreApi<BeamStore>>;


export const createBeamStore = () => createStore<BeamStore>()(
  (_set, _get) => ({

    // internal
    debugId: uuidv4(),

    // state
    isOpen: false,
    inputHistory: null,
    inputIssues: null,
    gatherLlmId: null,
    gatherMessage: null,
    gatherAbortController: null,
    rays: [],
    readyScatter: false,
    isScattering: false,
    readyGather: false,
    isGathering: false,


    open: (history: DMessage[], inheritLlmId: DLLMId | null) => {
      const { isOpen: wasOpen, close } = _get();

      // reset pending operations
      close();

      // if just opened, update the model with the current chat model
      const gatherLlmId = !wasOpen && inheritLlmId;

      // validate history
      const isValidHistory = history.length >= 1 && history[history.length - 1].role === 'user';
      _set({
        isOpen: true,
        inputHistory: isValidHistory ? history : null,
        inputIssues: isValidHistory ? null : 'Invalid history',
        ...(gatherLlmId ? { gatherLlmId } : {}),
        gatherMessage: isValidHistory ? createDMessage('assistant', PLACEHOLDER_GATHER_TEXT) : null,
        readyScatter: isValidHistory,
      });
    },

    close: () => { /*_get().isOpen &&*/
      const { rays: prevRays } = _get();

      // abort all rays and the gathermessage
      prevRays.forEach(rayScatterStop);

      _set({
        isOpen: false,
        inputHistory: null,
        inputIssues: null,
        // gatherLlmId: null,   // remember the selected llm
        gatherMessage: null,
        gatherAbortController: null,
        rays: prevRays.map((ray) => createDRay(ray.scatterLlmId /* remember only the model configuration */)),
        readyScatter: false,
        isScattering: false,
        readyGather: false,
        isGathering: false,
      });
    },


    setGatherLlmId: (llmId: DLLMId | null) => _set({
      gatherLlmId: llmId,
    }),

    setRayCount: (count: number) => {
      const { rays } = _get();
      if (count < rays.length) {
        rays.slice(count).forEach(rayScatterStop);
        _set({
          rays: rays.slice(0, count),
        });
      } else if (count > rays.length) {
        _set({
          rays: [...rays, ...Array(count - rays.length).fill(null).map(() => createDRay(_get().gatherLlmId))],
        });
      }
    },


    startScatteringAll: () => {
      const { readyScatter, isScattering, inputHistory, rays } = _get();
      if (!readyScatter) {
        console.warn('startScattering: not ready', { isScattering, readyScatter, inputHistory });
        return;
      }
      const newRays = rays.map(ray => rayScatterStart(ray, false, _get()));
      _set({
        isScattering: newRays.some((ray) => ray.status === 'scattering'),
        rays: newRays
      });
    },

    stopScatteringAll: () => {
      const { rays } = _get();
      _set({
        isScattering: false,
        rays: rays.map(ray => rayScatterStop(ray)),
      });
    },

    toggleScattering: (rayId: DRayId) => {
      const store = _get();
      const newRays = store.rays.map((ray) => (ray.rayId === rayId)
        ? (ray.status === 'scattering' ? rayScatterStop(ray) : rayScatterStart(ray, false, _get()))
        : ray,
      );
      const anyStarted = newRays.some((ray) => ray.status === 'scattering');
      _set({
        isScattering: anyStarted,
        rays: newRays,
      });
    },

    toggleUserSelection: (rayId: DRayId) => _set((state) => ({
      rays: state.rays.map((ray) => (ray.rayId === rayId)
        ? { ...ray, userSelected: !ray.userSelected }
        : ray,
      ),
    })),

    removeRay: (rayId: DRayId) => _set((state) => ({
      rays: state.rays.filter((ray) => {
        if (ray.rayId === rayId) {
          rayScatterStop(ray);
          return false;
        }
        return true;
      }),
    })),

    updateRay: (rayId: DRayId, update: Partial<DRay> | ((ray: DRay) => Partial<DRay>)) => _set((state) => ({
      rays: state.rays.map((ray) => (ray.rayId === rayId)
        ? { ...ray, ...(typeof update === 'function' ? update(ray) : update) }
        : ray,
      ),
    })),


    syncRaysStateToBeam: () => {
      const { rays } = _get();

      // Check if all rays have finished generating
      const allDone = rays.every(ray => ray.status !== 'scattering');

      if (allDone) {
        // If all rays are done, update state accordingly
        _set({
          isScattering: false,
          // Update other state properties as needed
        });
        // TODO... continue
        console.log('All rays have finished generating - TODO: ');
      }
    },

  }),
);


export const useBeamStore = <T, >(beamStore: BeamStoreApi, selector: (store: BeamStore) => T): T =>
  useStore(beamStore, selector);
