import { v4 as uuidv4 } from 'uuid';
import type { StateCreator } from 'zustand/vanilla';

import { streamAssistantMessage } from '../../../apps/chat/editors/chat-stream';

import type { DLLMId } from '~/modules/llms/store-llms';
import type { VChatMessageIn } from '~/modules/llms/llm.client';

import { createDMessage, DMessage } from '~/common/state/store-chats';
import { getUXLabsHighPerformance } from '~/common/state/store-ux-labs';

import type { RootStoreSlice } from '../store-beam-vanilla';
import { SCATTER_DEBUG_STATE, SCATTER_PLACEHOLDER } from '../beam.config';
import { updateBeamLastConfig } from '../store-module-beam';


export type BRayId = string;

export interface BRay {
  rayId: BRayId;
  status: 'empty' | 'scattering' | 'success' | 'stopped' | 'error';
  message: DMessage;
  rayLlmId: DLLMId | null;
  scatterIssue?: string;
  genAbortController?: AbortController;
  userSelected: boolean;
  imported: boolean;
}


export function createBRay(llmId: DLLMId | null): BRay {
  return {
    rayId: uuidv4(),
    status: 'empty',
    message: createDMessage('assistant', ''),
    rayLlmId: llmId,
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
  streamAssistantMessage(llmId, messagesHistory, 'beam-scatter', ray.rayId, getUXLabsHighPerformance() ? 0 : rays.length, 'off', updateMessage, abortController.signal)
    .then((status) => {
      _rayUpdate(ray.rayId, {
        status: (status.outcome === 'success') ? 'success'
          : (status.outcome === 'aborted') ? 'stopped'
            : (status.outcome === 'errored') ? 'error' : 'empty',
        scatterIssue: status.errorMessage || undefined,
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
    rayLlmId: llmId,
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
  hadImportedRays: boolean;

  // derived state
  isScattering: boolean; // true if any ray is scattering at the moment
  raysReady: number;     // 0, or number of the rays that are ready

}

export const reInitScatterStateSlice = (prevRays: BRay[]): ScatterStateSlice => {
  // stop all ongoing rays
  prevRays.forEach(rayScatterStop);

  return {
    // (remember) keep the same quantity of rays and same llms
    rays: prevRays.map(prevRay => createBRay(prevRay.rayLlmId)),
    hadImportedRays: false,

    isScattering: false,
    raysReady: 0,
  };
};

export interface ScatterStoreSlice extends ScatterStateSlice {

  // ray actions
  setRayCount: (count: number) => void;
  removeRay: (rayId: BRayId) => void;
  importRays: (messages: DMessage[], raysLlmId: DLLMId | null) => void;
  setRayLlmIds: (rayLlmIds: DLLMId[]) => void;
  startScatteringAll: () => void;
  stopScatteringAll: () => void;
  rayToggleScattering: (rayId: BRayId) => void;
  raySetLlmId: (rayId: BRayId, llmId: DLLMId | null) => void;
  _rayUpdate: (rayId: BRayId, update: Partial<BRay> | ((ray: BRay) => Partial<BRay>)) => void;

  _storeLastScatterConfig: () => void;
  _syncRaysStateToScatter: () => void;

}


export const createScatterSlice: StateCreator<RootStoreSlice & ScatterStoreSlice, [], [], ScatterStoreSlice> = (_set, _get) => ({

  // init state
  ...reInitScatterStateSlice([]),


  setRayCount: (count: number) => {
    const { rays, _storeLastScatterConfig, _syncRaysStateToScatter } = _get();
    if (count < rays.length) {
      // Terminate exceeding rays
      rays.slice(count).forEach(rayScatterStop);
      _set({
        rays: rays.slice(0, count),
      });
    } else if (count > rays.length) {
      _set({
        rays: [...rays, ...Array(count - rays.length).fill(null)
          // Create missing rays, copying the llmId of the former Ray, or using the fallback
          .map(() => createBRay(rays[rays.length - 1]?.rayLlmId || null)),
        ],
      });
    }
    _storeLastScatterConfig();
    _syncRaysStateToScatter();
  },

  removeRay: (rayId: BRayId) => {
    const { _storeLastScatterConfig, _syncRaysStateToScatter } = _get();
    _set(state => ({
      rays: state.rays.filter((ray) => {
        const shallStay = ray.rayId !== rayId;
        // Terminate the removed ray
        !shallStay && rayScatterStop(ray);
        return shallStay;
      }),
    }));
    _storeLastScatterConfig();
    _syncRaysStateToScatter();
  },

  importRays: (messages: DMessage[], raysLlmId: DLLMId | null) => {
    const { rays, _storeLastScatterConfig, _syncRaysStateToScatter } = _get();

    // remove the empty rays that will be replaced by the imported messages
    const raysToRemove = rays.filter((ray) => ray.status === 'empty' && ray.rayLlmId === raysLlmId).slice(0, messages.length);

    _set({
      rays: [
        // prepend the imported rays
        ...messages.map((message) => {
            // Note: message.originLLM misss the prefix (e.g. gpt-4-0125 wihtout 'openai-..') so it won't match here
            const ray = createBRay(raysLlmId);
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
        // append the other rays (excluding the ones to remove)
        ...rays.filter((ray) => !raysToRemove.includes(ray)),
      ],
      hadImportedRays: messages.length > 0,
    });
    _storeLastScatterConfig();
    _syncRaysStateToScatter();
  },

  setRayLlmIds: (rayLlmIds: DLLMId[]) => {
    const { setRayCount, _storeLastScatterConfig, _syncRaysStateToScatter } = _get();
    // NOTE: the behavior was to only enlarge the set, but turns out that the UX would be less intuitive
    // if (rayLlmIds.length > rays.length)
    setRayCount(rayLlmIds.length);
    _set(state => ({
      rays: state.rays.map((ray, index): BRay => index >= rayLlmIds.length ? ray : {
        ...ray,
        rayLlmId: rayLlmIds[index] || null,
      }),
    }));
    _storeLastScatterConfig();
    _syncRaysStateToScatter();
  },


  startScatteringAll: () => {
    const { inputHistory } = _get();
    _set(state => ({
      // Start all rays
      rays: state.rays.map(ray => rayScatterStart(ray, ray.rayLlmId, inputHistory || [], false, _get())),
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
    const { inputHistory, _rayUpdate, _syncRaysStateToScatter } = _get();
    _rayUpdate(rayId, (ray) =>
      ray.status === 'scattering'
        ? /* User Terminated the ray */ rayScatterStop(ray)
        : /* User Started the ray */ rayScatterStart(ray, ray.rayLlmId, inputHistory || [], false, _get()),
    );
    _syncRaysStateToScatter();
  },

  raySetLlmId: (rayId: BRayId, llmId: DLLMId | null) => {
    const { _rayUpdate, _storeLastScatterConfig } = _get();
    _rayUpdate(rayId, {
      rayLlmId: llmId,
    });
    _storeLastScatterConfig();
  },

  _rayUpdate: (rayId: BRayId, update: Partial<BRay> | ((ray: BRay) => Partial<BRay>)) =>
    _set(state => ({
      rays: state.rays.map(ray => (ray.rayId === rayId)
        ? { ...ray, ...(typeof update === 'function' ? update(ray) : update) }
        : ray,
      ),
    })),

  _storeLastScatterConfig: () => {
    updateBeamLastConfig({
      rayLlmIds: _get().rays.map(ray => ray.rayLlmId).filter(Boolean) as DLLMId[],
    });
  },

  _syncRaysStateToScatter: () => {
    const { rays } = _get();

    // Check if all rays have finished generating
    const hasRays = rays.length > 0;
    const allDone = !rays.some(rayIsScattering);
    const raysReady = rays.filter(rayIsSelectable).length;

    // [debug]
    if (SCATTER_DEBUG_STATE)
      console.log('_syncRaysStateToScatter', { rays: rays.length, allDone, raysReady, isScattering: hasRays && !allDone });

    _set({
      isScattering: hasRays && !allDone,
      raysReady,
    });
  },

});
