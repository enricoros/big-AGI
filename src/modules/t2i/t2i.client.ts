import * as React from 'react';
import { shallow } from 'zustand/shallow';

import { DLLM, DModelSource, DModelSourceId, useModelsStore } from '~/modules/llms/store-llms';
import { backendCaps } from '~/modules/backend/state-backend';

import type { CapabilityTextToImage, TextToImageProvider } from '~/common/components/useCapabilities';

import { openAIGenerateImagesOrThrow } from './dalle/openaiGenerateImages';
import { prodiaGenerateImages } from './prodia/prodiaGenerateImages';
import { useProdiaStore } from './prodia/store-module-prodia';
import { useTextToImageStore } from './store-module-t2i';


// Capabilities API - used by Settings, and whomever wants to check if this is available

export function useCapabilityTextToImage(): CapabilityTextToImage {

  // external state
  const { activeProviderId, setActiveProviderId } = useTextToImageStore(state => ({
    activeProviderId: state.activeProviderId,
    setActiveProviderId: state.setActiveProviderId,
  }), shallow);
  const hasProdiaModels = useProdiaStore(state => !!state.prodiaModelId);
  const openAIModelSourceIds: OpenAIModelSource[] = useModelsStore(
    ({ llms, sources }) => getOpenAIModelSources(llms, sources),
    (a, b) => a.length === b.length && a.every((_a, i) => shallow(_a, b[i])),
  );


  // derived state
  const providers = React.useMemo(() => {
    return getTextToImageProviders(openAIModelSourceIds, hasProdiaModels);
  }, [hasProdiaModels, openAIModelSourceIds]);


  // [Effect] Auto-select the first correctly configured provider
  React.useEffect(() => {
    const providedIDs = providers.map(p => p.id);
    if (activeProviderId && providedIDs.includes(activeProviderId))
      return;
    const autoSelectProvider = providers.find(p => p.configured);
    if (autoSelectProvider)
      setActiveProviderId(autoSelectProvider.id);
  }, [activeProviderId, providers, setActiveProviderId]);


  return {
    mayWork: providers.find(p => p.configured) !== undefined,
    providers,
    activeProviderId,
    setActiveProviderId,
  };
}


// T2I API

export function getActiveTextToImageProviderOrThrow() {

  // validate active Id
  const { activeProviderId } = useTextToImageStore.getState();
  if (!activeProviderId)
    throw new Error('No TextToImage Provider selected');

  // get all providers
  const { llms, sources } = useModelsStore.getState();
  const openAIModelSourceIds = getOpenAIModelSources(llms, sources);
  const providers = getTextToImageProviders(openAIModelSourceIds, !!useProdiaStore.getState().prodiaModelId);

  // find the active provider
  const activeProvider = providers.find(p => p.id === activeProviderId);
  if (!activeProvider)
    throw new Error('No TextToImage Provider found');

  return activeProvider;
}

export async function t2iGenerateImageOrThrow(provider: TextToImageProvider, prompt: string, count: number): Promise<string[]> {
  switch (provider.vendor) {

    case 'openai':
      if (!provider.id)
        throw new Error('No OpenAI model source configured for TextToImage');
      return await openAIGenerateImagesOrThrow(provider.id, prompt, count);

    case 'prodia':
      const hasProdiaServer = backendCaps().hasImagingProdia;
      const hasProdiaClientModels = !!useProdiaStore.getState().prodiaModelId;
      if (!hasProdiaServer && !hasProdiaClientModels)
        throw new Error('No Prodia configuration found for TextToImage');
      return await prodiaGenerateImages(prompt, count);

  }
}


/// Private

interface OpenAIModelSource {
  label: string;
  modelSourceId: DModelSourceId;
  hasModels: boolean;
}

function getOpenAIModelSources(llms: DLLM[], sources: DModelSource[]) {
  return sources.filter(s => s.vId === 'openai').map((s): OpenAIModelSource => ({
    label: s.label,
    modelSourceId: s.id,
    hasModels: !!llms.find(m => m.sId === s.id),
  }));
}

function getTextToImageProviders(openAIModelSources: OpenAIModelSource[], hasProdiaClientModels: boolean) {
  const providers: TextToImageProvider[] = [];

  // add all OpenAI providers
  for (const { modelSourceId, label, hasModels } of openAIModelSources) {
    providers.push({
      id: modelSourceId,
      label: label,
      painter: 'DALL·E',
      description: 'OpenAI\'s DALL·E models',
      configured: hasModels,
      vendor: 'openai',
    });
  }

  // add Prodia
  const hasProdiaServer = backendCaps().hasImagingProdia;
  providers.push({
    id: 'prodia',
    label: 'Prodia',
    painter: 'Prodia',
    description: 'Prodia\'s models',
    configured: hasProdiaServer || hasProdiaClientModels,
    vendor: 'prodia',
  });

  return providers;
}