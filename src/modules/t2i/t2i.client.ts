import * as React from 'react';
import { shallow } from 'zustand/shallow';
import { useShallow } from 'zustand/react/shallow';

import type { ModelVendorId } from '~/modules/llms/vendors/vendors.registry';
import { DLLM, DModelSource, DModelSourceId, useModelsStore } from '~/modules/llms/store-llms';
import { getBackendCapabilities } from '~/modules/backend/store-backend-capabilities';

import type { CapabilityTextToImage, TextToImageProvider } from '~/common/components/useCapabilities';

import { openAIGenerateImagesOrThrow } from './dalle/openaiGenerateImages';
import { prodiaGenerateImages } from './prodia/prodiaGenerateImages';
import { useProdiaStore } from './prodia/store-module-prodia';
import { useTextToImageStore } from './store-module-t2i';


// configuration
// Note: LocalAI t2i integration is experimental
const T2I_ENABLE_LOCALAI = false;


// Capabilities API - used by Settings, and whomever wants to check if this is available

export function useCapabilityTextToImage(): CapabilityTextToImage {

  // external state

  const { activeProviderId, setActiveProviderId } = useTextToImageStore(useShallow(state => ({
    activeProviderId: state.activeProviderId,
    setActiveProviderId: state.setActiveProviderId,
  })));

  const llmsModelSources: LlmsModelSources[] = useModelsStore(
    ({ llms, sources }) => getLlmsModelSources(llms, sources),
    (a, b) => a.length === b.length && a.every((_a, i) => shallow(_a, b[i])),
  );

  const hasProdiaModels = useProdiaStore(state => !!state.prodiaModelId);


  // derived state

  const providers = React.useMemo(() => {
    return getTextToImageProviders(llmsModelSources, hasProdiaModels);
  }, [hasProdiaModels, llmsModelSources]);


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

  // [immediate] get all providers
  const { llms, sources } = useModelsStore.getState();
  const openAIModelSourceIds = getLlmsModelSources(llms, sources);
  const providers = getTextToImageProviders(openAIModelSourceIds, !!useProdiaStore.getState().prodiaModelId);

  // find the active provider
  const activeProvider = providers.find(p => p.id === activeProviderId);
  if (!activeProvider)
    throw new Error('Text-to-image is not configured correctly');

  return activeProvider;
}

export async function t2iGenerateImageOrThrow(provider: TextToImageProvider, prompt: string, count: number): Promise<string[]> {
  switch (provider.vendor) {

    case 'openai':
      if (!provider.id)
        throw new Error('No OpenAI model source configured for TextToImage');
      return await openAIGenerateImagesOrThrow(provider.id, prompt, count);

    case 'localai':
      throw new Error('LocalAI t2i integration is not yet available');
      // if (!provider.id)
      //   throw new Error('No LocalAI model source configured for TextToImage');
      // return await localaiGenerateImages(provider.id, prompt, count);

    case 'prodia':
      const hasProdiaServer = getBackendCapabilities().hasImagingProdia;
      const hasProdiaClientModels = !!useProdiaStore.getState().prodiaModelId;
      if (!hasProdiaServer && !hasProdiaClientModels)
        throw new Error('No Prodia configuration found for TextToImage');
      return await prodiaGenerateImages(prompt, count);

  }
}


/// Private

interface LlmsModelSources {
  label: string;
  modelVendorId: ModelVendorId;
  modelSourceId: DModelSourceId;
  hasAnyModels: boolean;
}

function getLlmsModelSources(llms: DLLM[], sources: DModelSource[]) {
  return sources.filter(s => (s.vId === 'openai' || (T2I_ENABLE_LOCALAI && s.vId === 'localai'))).map((s): LlmsModelSources => ({
    label: s.label,
    modelVendorId: s.vId,
    modelSourceId: s.id,
    hasAnyModels: llms.some(m => m.sId === s.id),
  }));
}

function getTextToImageProviders(llmsModelSources: LlmsModelSources[], hasProdiaClientModels: boolean) {
  const providers: TextToImageProvider[] = [];

  // add OpenAI and/or LocalAI providers
  for (const { modelVendorId, modelSourceId, label, hasAnyModels } of llmsModelSources) {
    switch (modelVendorId) {
      case 'localai':
        providers.push({
          id: modelSourceId,
          label: label,
          painter: 'LocalAI',
          description: 'LocalAI\'s models',
          configured: hasAnyModels,
          vendor: 'localai',
        });
        break;

      case 'openai':
        providers.push({
          id: modelSourceId,
          label: label,
          painter: 'DALL·E',
          description: 'OpenAI\'s DALL·E models',
          configured: hasAnyModels,
          vendor: 'openai',
        });
        break;

      default:
        console.error('Unknown model vendor', modelVendorId);
        break;
    }
  }

  // add Prodia provider
  const hasProdiaServer = getBackendCapabilities().hasImagingProdia;
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