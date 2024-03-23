import { v4 as uuidv4 } from 'uuid';
import type { StateCreator } from 'zustand/vanilla';

import { streamAssistantMessage } from '../../../apps/chat/editors/chat-stream';

import type { DLLMId } from '~/modules/llms/store-llms';
import type { VChatMessageIn } from '~/modules/llms/llm.client';

import { createDMessage, DMessage } from '~/common/state/store-chats';
import { getUXLabsHighPerformance } from '~/common/state/store-ux-labs';

import type { GatherStoreSlice } from '../gather/beam.gather';
import type { RootStoreSlice } from '../store-beam-vanilla';
import { SCATTER_DEBUG_STATE, SCATTER_PLACEHOLDER } from '../beam.config';


export type BRayId = string;

export interface BRay {
  rayId: BRayId;
  status: 'empty' | 'scattering' | 'success' | 'stopped' | 'error';
  message: DMessage;
  scatterLlmId: DLLMId | null;
  scatterIssue?: string;
  genAbortController?: AbortController;
  userSelected: boolean;
  imported: boolean;
}


export function createBRay(scatterLlmId: DLLMId | null): BRay {
  return {
    rayId: uuidv4(),
    status: 'empty',
    message: createDMessage('assistant', ''),
    scatterLlmId,
    userSelected: false,
    imported: false,
  };
}

function rayScatterStart(ray: BRay, llmId: DLLMId | null, inputHistory: DMessage[], onlyIdle: boolean, scatterStore: ScatterStoreSlice): BRay {
  if (ray.genAbortController)
    return ray;
  if (onlyIdle && ray.status !== 'empty')
    return ray;
  if (!llmId)
    return { ...ray, scatterIssue: 'No model selected' };

  const { rays, _rayUpdate, _syncRaysStateToScatter } = scatterStore;

  // validate history
  if (!inputHistory || inputHistory.length < 1 || inputHistory[inputHistory.length - 1].role !== 'user')
    return { ...ray, scatterIssue: `Invalid conversation history (${inputHistory?.length})` };

  const abortController = new AbortController();

  const updateMessage = (update: Partial<DMessage>) => _rayUpdate(ray.rayId, (ray) => ({
    ...ray,
    message: {
      ...ray.message,
      ...update,
      // only update the timestamp when the text changes
      ...(update.text ? { updated: Date.now() } : {}),
    },
  }));

  // stream the assistant's messages
  const messagesHistory: VChatMessageIn[] = inputHistory.map(({ role, text }) => ({ role, content: text }));
  streamAssistantMessage(llmId, messagesHistory, getUXLabsHighPerformance() ? 0 : rays.length, 'off', updateMessage, abortController.signal)
    .then((outcome) => {
      _rayUpdate(ray.rayId, {
        status: (outcome === 'success') ? 'success' : (outcome === 'aborted') ? 'stopped' : (outcome === 'errored') ? 'error' : 'empty',
        genAbortController: undefined,
      });
    })
    .catch((error) => {
      _rayUpdate(ray.rayId, {
        status: 'error',
        scatterIssue: error?.message || error?.toString() || 'Unknown error',
        genAbortController: undefined,
      });
    })
    .finally(() => {
      _syncRaysStateToScatter();
    });

  return {
    rayId: ray.rayId,
    status: 'scattering',
    message: {
      ...ray.message,
      text: SCATTER_PLACEHOLDER,
      created: Date.now(),
      updated: null,
    },
    scatterLlmId: llmId,
    scatterIssue: undefined,
    genAbortController: abortController,
    userSelected: false,
    imported: false,
  };
}

function rayScatterStop(ray: BRay): BRay {
  ray.genAbortController?.abort();
  return {
    ...ray,
    ...(ray.status === 'scattering' ? { status: 'stopped' } : {}),
    genAbortController: undefined,
  };
}


export function rayIsError(ray: BRay | null): boolean {
  return ray?.status === 'error';
}

export function rayIsScattering(ray: BRay | null): boolean {
  return ray?.status === 'scattering';
}

export function rayIsSelectable(ray: BRay | null): boolean {
  return !!ray?.message && !!ray.message.updated && !!ray.message.text && ray.message.text !== SCATTER_PLACEHOLDER;
}

export function rayIsUserSelected(ray: BRay | null): boolean {
  return !!ray?.userSelected;
}

export function rayIsImported(ray: BRay | null): boolean {
  return !!ray?.imported;
}


/// Scatter Store Slice ///

interface ScatterStateSlice {

  rays: BRay[];

  isScattering: boolean; // true if any ray is scattering at the moment
  raysReady: number;     // 0, or number of the rays that are ready to gather

}

export const reInitScatterStateSlice = (prevRays: BRay[]): ScatterStateSlice => {
  // stop all ongoing rays
  prevRays.forEach(rayScatterStop);

  return {
    // (remember) keep the same quantity of rays and same llms
    rays: prevRays.map((prevRay) => createBRay(prevRay.scatterLlmId)),

    isScattering: false,
    raysReady: 0,
  };
};

export interface ScatterStoreSlice extends ScatterStateSlice {

  // ray actions
  setRayCount: (count: number) => void;
  removeRay: (rayId: BRayId) => void;
  importRays: (messages: DMessage[]) => void;
  setScatterLLMIds: (scatterLLMIDs: DLLMId[]) => void;
  startScatteringAll: () => void;
  stopScatteringAll: () => void;
  rayToggleScattering: (rayId: BRayId) => void;
  raySetScatterLlmId: (rayId: BRayId, llmId: DLLMId | null) => void;
  _rayUpdate: (rayId: BRayId, update: Partial<BRay> | ((ray: BRay) => Partial<BRay>)) => void;

  _syncRaysStateToScatter: () => void;

}


export const createScatterSlice: StateCreator<RootStoreSlice & GatherStoreSlice & ScatterStoreSlice, [], [], ScatterStoreSlice> = (_set, _get) => ({

  // init state
  ...reInitScatterStateSlice([]),


  setRayCount: (count: number) => {
    const { rays, _syncRaysStateToScatter } = _get();
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
    _syncRaysStateToScatter();
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
    _get()._syncRaysStateToScatter();
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
    _get()._syncRaysStateToScatter();
  },

  setScatterLLMIds: (scatterLLMIDs: DLLMId[]) => {
    const { rays, setRayCount, _syncRaysStateToScatter } = _get();
    if (scatterLLMIDs.length > rays.length)
      setRayCount(scatterLLMIDs.length);
    _set(state => ({
      rays: state.rays.map((ray, index) => index >= scatterLLMIDs.length ? ray : {
        ...ray,
        scatterLlmId: scatterLLMIDs[index] || null,
      }),
    }));
    _syncRaysStateToScatter();
  },


  startScatteringAll: () => {
    const { inputHistory, gatherLlmId } = _get();
    _set(state => ({
      // Start all rays
      rays: state.rays.map(ray => rayScatterStart(ray, ray.scatterLlmId || gatherLlmId, inputHistory || [], false, _get())),
    }));
    _get()._syncRaysStateToScatter();
  },

  stopScatteringAll: () =>
    _set(state => ({
      isScattering: false,
      // Terminate all rays
      rays: state.rays.map(rayScatterStop),
    })),

  rayToggleScattering: (rayId: BRayId) => {
    const { inputHistory, gatherLlmId, _rayUpdate, _syncRaysStateToScatter } = _get();
    _rayUpdate(rayId, (ray) =>
      ray.status === 'scattering'
        ? /* User Terminated the ray */ rayScatterStop(ray)
        : /* User Started the ray */ rayScatterStart(ray, ray.scatterLlmId || gatherLlmId, inputHistory || [], false, _get()),
    );
    _syncRaysStateToScatter();
  },

  raySetScatterLlmId: (rayId: BRayId, llmId: DLLMId | null) =>
    _get()._rayUpdate(rayId, {
      scatterLlmId: llmId,
    }),

  _rayUpdate: (rayId: BRayId, update: Partial<BRay> | ((ray: BRay) => Partial<BRay>)) =>
    _set(state => ({
      rays: state.rays.map(ray => (ray.rayId === rayId)
        ? { ...ray, ...(typeof update === 'function' ? update(ray) : update) }
        : ray,
      ),
    })),


  _syncRaysStateToScatter: () => {
    const { rays } = _get();

    // Check if all rays have finished generating
    const hasRays = rays.length > 0;
    const allDone = !rays.some(rayIsScattering);
    const raysReady = rays.filter(rayIsSelectable).length;

    // [debug]
    if (SCATTER_DEBUG_STATE)
      console.log('_syncRaysStateToBeam', { rays: rays.length, allDone, raysReady, isScattering: hasRays && !allDone });

    _set({
      isScattering: hasRays && !allDone,
      raysReady,
    });
  },

});
