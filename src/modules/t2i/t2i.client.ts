import * as React from 'react';

import type { DBlobDBContextId, DBlobDBScopeId } from '~/modules/dblobs/dblobs.types';
import type { ModelVendorId } from '~/modules/llms/vendors/vendors.registry';
import { addDBImageAsset } from '~/modules/dblobs/dblobs.images';
import { getBackendCapabilities } from '~/modules/backend/store-backend-capabilities';

import type { CapabilityTextToImage, TextToImageProvider } from '~/common/components/useCapabilities';
import type { DLLM } from '~/common/stores/llms/llms.types';
import type { DModelsService, DModelsServiceId } from '~/common/stores/llms/modelsservice.types';
import { createDMessageDataRefDBlob, createImageContentFragment, DMessageContentFragment } from '~/common/stores/chat/chat.fragments';
import { llmsStoreState, useModelsStore } from '~/common/stores/llms/store-llms';
import { shallowEquals } from '~/common/util/hooks/useShallowObject';

import type { T2iCreateImageOutput } from './t2i.server';
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

  const activeProviderId = useTextToImageStore(state => state.activeProviderId);
  const setActiveProviderId = useTextToImageStore.getState().setActiveProviderId;

  const stableLlmsModelServices = React.useRef<T2ILlmsModelServices[]>();
  const llmsModelServices = useModelsStore(({ llms, sources }) => {
    const next = getLlmsModelServices(llms, sources);
    const prev = stableLlmsModelServices.current;
    if (prev
      && prev.length === next.length
      && prev.every((v, i) => shallowEquals(v, next[i]))
    ) return prev;
    return stableLlmsModelServices.current = next;
  });

  const hasProdiaModels = useProdiaStore(state => !!state.prodiaModelId);


  // derived state

  const providers = React.useMemo(() => {
    return getTextToImageProviders(llmsModelServices, hasProdiaModels);
  }, [hasProdiaModels, llmsModelServices]);


  // [Effect] Auto-select the first correctly configured provider
  React.useEffect(() => {
    const providedIDs = providers.map(p => p.providerId);
    if (activeProviderId && providedIDs.includes(activeProviderId))
      return;
    const autoSelectProvider = providers.find(p => p.configured);
    if (autoSelectProvider)
      setActiveProviderId(autoSelectProvider.providerId);
  }, [activeProviderId, providers, setActiveProviderId]);


  return {
    mayWork: providers.some(p => p.configured),
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
  const { llms, sources: modelsServices } = llmsStoreState();
  const openAIModelsServiceIDs = getLlmsModelServices(llms, modelsServices);
  const providers = getTextToImageProviders(openAIModelsServiceIDs, !!useProdiaStore.getState().prodiaModelId);

  // find the active provider
  const activeProvider = providers.find(p => p.providerId === activeProviderId);
  if (!activeProvider)
    throw new Error('Text-to-image is not configured correctly');

  return activeProvider;
}

async function _t2iGenerateImagesOrThrow({ providerId, vendor }: TextToImageProvider, prompt: string, count: number): Promise<T2iCreateImageOutput[]> {
  switch (vendor) {

    case 'localai':
      // if (!provider.providerId)
      //   throw new Error('No LocalAI Model service configured for TextToImage');
      // return await localaiGenerateImages(provider.id, prompt, count);
      throw new Error('LocalAI t2i integration is not yet available');

    case 'openai':
      if (!providerId)
        throw new Error('No OpenAI Model Service configured for TextToImage');
      return await openAIGenerateImagesOrThrow(providerId, prompt, count);

    case 'prodia':
      const hasProdiaServer = getBackendCapabilities().hasImagingProdia;
      const hasProdiaClientModels = !!useProdiaStore.getState().prodiaModelId;
      if (!hasProdiaServer && !hasProdiaClientModels)
        throw new Error('No Prodia configuration found for TextToImage');
      return await prodiaGenerateImages(prompt, count);

  }
}

/**
 * Generate image content fragments using the provided TextToImageProvider
 * If t2iprovider is null, the active provider will be used
 */
export async function t2iGenerateImageContentFragments(
  t2iProvider: TextToImageProvider | null, prompt: string, count: number,
  contextId: DBlobDBContextId, scopeId: DBlobDBScopeId,
): Promise<DMessageContentFragment[]> {

  // T2I: Use the active provider if null
  if (!t2iProvider)
    t2iProvider = getActiveTextToImageProviderOrThrow();

  // T2I: Generate
  const generatedImages = await _t2iGenerateImagesOrThrow(t2iProvider, prompt, count);
  if (!generatedImages?.length)
    throw new Error('No image generated');

  const imageFragments: DMessageContentFragment[] = [];
  for (const _i of generatedImages) {

    // add the image to the DB
    const dblobAssetId = await addDBImageAsset(contextId, scopeId, {
      label: prompt,
      data: {
        mimeType: _i.mimeType as any,
        base64: _i.base64Data,
      },
      origin: {
        ot: 'generated',
        source: 'ai-text-to-image',
        generatorName: _i.generatorName,
        prompt: _i.altText,
        parameters: _i.parameters,
        generatedAt: _i.generatedAt,
      },
      metadata: {
        width: _i.width || 0,
        height: _i.height || 0,
        // description: '',
      },
    });

    // create a data reference for the image
    const imageAssetDataRef = createDMessageDataRefDBlob(dblobAssetId, _i.mimeType, _i.base64Data.length);

    // create an Image Content Fragment
    const imageContentFragment = createImageContentFragment(imageAssetDataRef, _i.altText, _i.width, _i.height);
    imageFragments.push(imageContentFragment);
  }
  return imageFragments;
}


/// Private

interface T2ILlmsModelServices {
  label: string;
  modelVendorId: ModelVendorId;
  modelServiceId: DModelsServiceId;
  hasAnyModels: boolean;
}

function getLlmsModelServices(llms: DLLM[], services: DModelsService[]) {
  return services.filter(s => (s.vId === 'openai' || (T2I_ENABLE_LOCALAI && s.vId === 'localai'))).map((s): T2ILlmsModelServices => ({
    label: s.label,
    modelVendorId: s.vId,
    modelServiceId: s.id,
    hasAnyModels: llms.some(m => m.sId === s.id),
  }));
}

function getTextToImageProviders(llmsModelServices: T2ILlmsModelServices[], hasProdiaClientModels: boolean) {
  const providers: TextToImageProvider[] = [];

  // add OpenAI and/or LocalAI providers
  for (const { modelVendorId, modelServiceId, label, hasAnyModels } of llmsModelServices) {
    switch (modelVendorId) {
      case 'localai':
        providers.push({
          providerId: modelServiceId,
          label: label,
          painter: 'LocalAI',
          description: 'LocalAI\'s models',
          configured: hasAnyModels,
          vendor: 'localai',
        });
        break;

      case 'openai':
        providers.push({
          providerId: modelServiceId,
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
    providerId: 'prodia',
    label: 'Prodia',
    painter: 'Prodia',
    description: 'Prodia\'s models',
    configured: hasProdiaServer || hasProdiaClientModels,
    vendor: 'prodia',
  });

  return providers;
}