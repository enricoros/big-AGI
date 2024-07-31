import * as React from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useStoreWithEqualityFn } from 'zustand/traditional';

import type { DBlobDBContextId, DBlobDBScopeId } from '~/modules/dblobs/dblobs.types';
import type { ModelVendorId } from '~/modules/llms/vendors/vendors.registry';
import { DLLM, DModelSource, DModelSourceId, useModelsStore } from '~/modules/llms/store-llms';
import { addDBImageAsset } from '~/modules/dblobs/dblobs.images';
import { getBackendCapabilities } from '~/modules/backend/store-backend-capabilities';

import type { CapabilityTextToImage, TextToImageProvider } from '~/common/components/useCapabilities';
import { createDMessageDataRefDBlob, createImageContentFragment, DMessageContentFragment } from '~/common/stores/chat/chat.fragments';
import { shallowEquals } from '~/common/util/useShallowObject';

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

  const { activeProviderId, setActiveProviderId } = useTextToImageStore(useShallow(state => ({
    activeProviderId: state.activeProviderId,
    setActiveProviderId: state.setActiveProviderId,
  })));

  const llmsModelSources: LlmsModelSources[] = useStoreWithEqualityFn(useModelsStore,
    ({ llms, sources }) => getLlmsModelSources(llms, sources),
    (a, b) =>
      a.length === b.length
      && a.every((_a, i) => shallowEquals(_a, b[i])),
  );

  const hasProdiaModels = useProdiaStore(state => !!state.prodiaModelId);


  // derived state

  const providers = React.useMemo(() => {
    return getTextToImageProviders(llmsModelSources, hasProdiaModels);
  }, [hasProdiaModels, llmsModelSources]);


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
  const { llms, sources } = useModelsStore.getState();
  const openAIModelSourceIds = getLlmsModelSources(llms, sources);
  const providers = getTextToImageProviders(openAIModelSourceIds, !!useProdiaStore.getState().prodiaModelId);

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
      //   throw new Error('No LocalAI model source configured for TextToImage');
      // return await localaiGenerateImages(provider.id, prompt, count);
      throw new Error('LocalAI t2i integration is not yet available');

    case 'openai':
      if (!providerId)
        throw new Error('No OpenAI model source configured for TextToImage');
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
          providerId: modelSourceId,
          label: label,
          painter: 'LocalAI',
          description: 'LocalAI\'s models',
          configured: hasAnyModels,
          vendor: 'localai',
        });
        break;

      case 'openai':
        providers.push({
          providerId: modelSourceId,
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