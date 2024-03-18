import { v4 as uuidv4 } from 'uuid';

import { streamAssistantMessage } from '../../apps/chat/editors/chat-stream';

import type { DLLMId } from '~/modules/llms/store-llms';

import { createDMessage, DMessage } from '~/common/state/store-chats';
import { getUXLabsHighPerformance } from '~/common/state/store-ux-labs';

import type { BeamStore } from './store-beam';


// configuration
const PLACEHOLDER_SCATTER_TEXT = '🖊️ ...'; // 💫 ..., 🖊️ ...


export type DRayId = string;

export interface DRay {
  rayId: DRayId;
  status: 'empty' | 'scattering' | 'success' | 'stopped' | 'error';
  message: DMessage;
  scatterLlmId: DLLMId | null;
  scatterIssue?: string;
  genAbortController?: AbortController;
  userSelected: boolean;
  imported: boolean;
}


export function createDRay(scatterLlmId: DLLMId | null): DRay {
  return {
    rayId: uuidv4(),
    status: 'empty',
    message: createDMessage('assistant', ''),
    scatterLlmId,
    userSelected: false,
    imported: false,
  };
}

export function rayScatterStart(ray: DRay, onlyIdle: boolean, beamStore: BeamStore): DRay {
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
  streamAssistantMessage(rayLlmId, inputHistory, getUXLabsHighPerformance() ? 0 : rays.length, 'off', updateMessage, abortController.signal)
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

export function rayScatterStop(ray: DRay): DRay {
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

export function rayIsImported(ray: DRay | null): boolean {
  return !!ray?.imported;
}
