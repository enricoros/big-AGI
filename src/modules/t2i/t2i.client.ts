import * as React from 'react';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { DModelSourceId } from '~/modules/llms/store-llms';
import { backendCaps } from '~/modules/backend/state-backend';
import { openAIGenerateImagesOrThrow } from '~/modules/t2i/openai/openaiGenerateImages';

import type { CapabilityTextToImage, CapabilityTextToImageProvider } from '~/common/components/useCapabilities';

import { prodiaGenerateImages } from './prodia/prodiaGenerateImages';
import { useProdiaStore } from './prodia/store-module-prodia';


export const CmdRunT2I: string[] = ['/draw', '/imagine', '/img'];


// T2I persisted store

interface T2IStore {

  activeProviderId: string | null;
  setActiveProvider: (providerId: string | null) => void;

  openAIModelSourceId: DModelSourceId | null;
  setOpenAIModelSourceId: (id: DModelSourceId | null) => void;

}

const useT2IStore = create<T2IStore>()(
  persist(
    (_set, _get) => ({

      activeProviderId: null,
      setActiveProvider: (providerId: string | null) => _set({ activeProviderId: providerId }),

      openAIModelSourceId: null,
      setOpenAIModelSourceId: (id: DModelSourceId | null) => _set({ openAIModelSourceId: id }),

    }),
    {
      name: 'module-t2i',
    }),
);


// Capabilities API - used by Settings, and whomever wants to check if this is available

export function useCapabilityTextToImage(): CapabilityTextToImage {

  // external state
  const { activeProviderId, openAIModelSourceId, setActiveProvider } = useT2IStore();
  const hasProdiaClient = useProdiaStore(state => !!state.prodiaModelId);

  // cache the list of t2i providers
  const providers = React.useMemo(() =>
      getProviders(activeProviderId, openAIModelSourceId, hasProdiaClient)
    , [activeProviderId, hasProdiaClient, openAIModelSourceId]);

  return {
    mayWork: providers.length > 0,
    providers,
    setActiveProvider,
  };
}


// T2I API

export async function t2iGenerateImageOrThrow(prompt: string, count: number): Promise<string[]> {
  switch (useT2IStore.getState().activeProviderId) {

    case 'openai':
      // validate correct OpenAI configuration
      const { openAIModelSourceId } = useT2IStore.getState();
      if (!openAIModelSourceId)
        throw new Error('No OpenAI model source configured');
      return await openAIGenerateImagesOrThrow(openAIModelSourceId, prompt, count);

    case 'prodia':
      // validate correct Prodia configuration
      const hasProdiaServer = backendCaps().hasImagingProdia;
      const hasProdiaClientModels = !!useProdiaStore.getState().prodiaModelId;
      if (!hasProdiaServer && !hasProdiaClientModels)
        throw new Error('No Prodia configuration found');
      return await prodiaGenerateImages(prompt, count);

    default:
      throw new Error('Select a TextToImage Provider');

  }
}

export const t2iSetOpenAIModelSourceId = (id: DModelSourceId | null) =>
  useT2IStore.getState().setOpenAIModelSourceId(id);


/// Private

// function getActiveProvider() {
//   // get a state snapshot
//   const { activeProviderId, openAIModelSourceId } = useT2IStore.getState();
//   const hasProdiaClientModels = !!useProdiaStore.getState().prodiaModelId;
//
//   // find the active provider
//   return getProviders(activeProviderId, openAIModelSourceId, hasProdiaClientModels).find(p => p.active);
// }

function getProviders(activeProviderId: string | null, openAIModelSourceId: string | null, hasProdiaClientModels: boolean): CapabilityTextToImageProvider[] {
  const providers: CapabilityTextToImageProvider[] = [];

  // add OpenAI if configured
  if (openAIModelSourceId) {
    providers.push({
      id: 'openai',
      label: 'OpenAI',
      description: 'OpenAI\'s Dall-E models',
      active: activeProviderId === 'openai',
      // llmSourceID: openAIModelSourceId,
    } satisfies CapabilityTextToImageProvider);
  }

  // add Prodia if configured
  const hasProdiaServer = backendCaps().hasImagingProdia;
  if (hasProdiaServer || hasProdiaClientModels) {
    providers.push({
      id: 'prodia',
      label: 'Prodia',
      description: 'Prodia\'s models',
      active: activeProviderId === 'prodia',
    } satisfies CapabilityTextToImageProvider);
  }

  return providers;
}