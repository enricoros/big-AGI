import { v4 as uuidv4 } from 'uuid';
import { createStore } from 'zustand/vanilla';

import { streamAssistantMessage } from '../../apps/chat/editors/chat-stream';

import type { DLLMId } from '~/modules/llms/store-llms';

import { createDMessage, DMessage } from '~/common/state/store-chats';


// configuration
const PLACEHOLDER_SCATTER_TEXT = '🖊️ ...'; // 💫 ..., 🖊️ ...
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
  imported: boolean;
}

function createDRay(scatterLlmId: DLLMId | null): DRay {
  return {
    rayId: uuidv4(),
    status: 'empty',
    message: createDMessage('assistant', ''),
    scatterLlmId,
    userSelected: false,
    imported: false,
  };
}

function rayScatterStart(ray: DRay, onlyIdle: boolean, beamStore: BeamStore): DRay {
  if (ray.genAbortController)
    return ray;
  if (onlyIdle && ray.status !== 'empty')
    return ray;

  const { gatherLlmId, inputHistory, rays, _updateRay, syncRaysStateToBeam } = beamStore;

  // validate model
  const rayLlmId = ray.scatterLlmId || gatherLlmId;
  if (!rayLlmId)
    return { ...ray, scatterIssue: 'No model selected' };

  // validate history
  if (!inputHistory || inputHistory.length < 1 || inputHistory[inputHistory.length - 1].role !== 'user')
    return { ...ray, scatterIssue: `Invalid conversation history (${inputHistory?.length})` };

  const abortController = new AbortController();

  const updateMessage = (update: Partial<DMessage>) => _updateRay(ray.rayId, (ray) => ({
    ...ray,
    message: {
      ...ray.message,
      ...update,
      // only update the timestamp when the text changes
      ...(update.text ? { updated: Date.now() } : {}),
    },
  }));

  // stream the assistant's messages
  streamAssistantMessage(rayLlmId, inputHistory, rays.length, 'off', updateMessage, abortController.signal)
    .then((outcome) => {
      _updateRay(ray.rayId, {
        status: (outcome === 'success') ? 'success' : (outcome === 'aborted') ? 'stopped' : (outcome === 'errored') ? 'error' : 'empty',
        genAbortController: undefined,
      });
    })
    .catch((error) => {
      _updateRay(ray.rayId, {
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
      created: Date.now(),
      updated: null,
    },
    scatterLlmId: rayLlmId,
    scatterIssue: undefined,
    genAbortController: abortController,
    userSelected: false,
    imported: false,
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

type BeamSuccessCallback = (text: string, llmId: DLLMId) => void;

interface BeamState {

  isOpen: boolean;
  inputHistory: DMessage[] | null;
  inputIssues: string | null;
  onSuccessCallback: BeamSuccessCallback | null;

  rays: DRay[];

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

  setRayCount: (count: number) => void;
  removeRay: (rayId: DRayId) => void;
  importRays: (messages: DMessage[]) => void;

  setGatherLlmId: (llmId: DLLMId | null) => void;

  startScatteringAll: () => void;
  stopScatteringAll: () => void;
  toggleScattering: (rayId: DRayId) => void;
  toggleUserSelection: (rayId: DRayId) => void;
  setRayLlmId: (rayId: DRayId, llmId: DLLMId | null) => void;
  _updateRay: (rayId: DRayId, update: Partial<DRay> | ((ray: DRay) => Partial<DRay>)) => void;

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
      const gatherLlmId = !wasOpen && inheritLlmId;

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
        rays: prevRays.map((prevRay) => createDRay(prevRay.scatterLlmId)),
        gatherLlmId: prevGatherLlmId,
      });
    },


    setRayCount: (count: number) => {
      const { rays, syncRaysStateToBeam } = _get();
      if (count < rays.length) {
        rays.slice(count).forEach(rayScatterStop);
        _set({
          rays: rays.slice(0, count),
        });
      } else if (count > rays.length) {
        _set({
          rays: [...rays, ...Array(count - rays.length).fill(null).map(() => createDRay(null))],
        });
      }
      syncRaysStateToBeam();
    },

    removeRay: (rayId: DRayId) => {
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
              const ray = createDRay(null);
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

    toggleScattering: (rayId: DRayId) => {
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

    toggleUserSelection: (rayId: DRayId) => _set((state) => ({
      rays: state.rays.map((ray) => (ray.rayId === rayId)
        ? { ...ray, userSelected: !ray.userSelected }
        : ray,
      ),
    })),

    setRayLlmId: (rayId: DRayId, llmId: DLLMId | null) => _set((state) => ({
      rays: state.rays.map((ray) => (ray.rayId === rayId)
        ? { ...ray, scatterLlmId: llmId }
        : ray,
      ),
    })),


    _updateRay: (rayId: DRayId, update: Partial<DRay> | ((ray: DRay) => Partial<DRay>)) => _set((state) => ({
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
