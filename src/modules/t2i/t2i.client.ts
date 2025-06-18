import * as React from 'react';

import type { AixParts_InlineImagePart } from '~/modules/aix/server/api/aix.wiretypes';
import type { DBlobDBContextId, DBlobDBScopeId } from '~/modules/dblobs/dblobs.types';
import type { ModelVendorId } from '~/modules/llms/vendors/vendors.registry';
import { addDBImageAsset } from '~/modules/dblobs/dblobs.images';
import { getBackendCapabilities } from '~/modules/backend/store-backend-capabilities';
import { useDalleStore } from '~/modules/t2i/dalle/store-module-dalle';

import type { CapabilityTextToImage, TextToImageProvider } from '~/common/components/useCapabilities';
import type { DLLM } from '~/common/stores/llms/llms.types';
import type { DModelsService, DModelsServiceId } from '~/common/stores/llms/llms.service.types';
import { createDMessageDataRefDBlob, createImageContentFragment, DMessageContentFragment } from '~/common/stores/chat/chat.fragments';
import { llmsStoreState, useModelsStore } from '~/common/stores/llms/store-llms';
import { shallowEquals } from '~/common/util/hooks/useShallowObject';

import { apiAsync } from '~/common/util/trpc.client';
import type { T2iCreateImageOutput } from './t2i.server';
import { openAIGenerateImagesOrThrow, openAIImageModelsCurrentGeneratorName } from './dalle/openaiGenerateImages';
import { prodiaGenerateImages } from './prodia/prodiaGenerateImages';
import { useProdiaStore } from './prodia/store-module-prodia';
import { useTextToImageStore } from './store-module-t2i';


// configuration
const T2I_ENABLE_LOCAL_AI = false; // Note: LocalAI t2i integration is experimental


// Capabilities API - used by Settings, and whomever wants to check if this is available

export function useCapabilityTextToImage(): CapabilityTextToImage {

  // external state

  const activeProviderId = useTextToImageStore(state => state.activeProviderId);

  const dalleModelId = useDalleStore(state => state.dalleModelId);

  const stableLlmsModelServices = React.useRef<T2ILlmsModelServices[]>(undefined);
  const llmsModelServices = useModelsStore(({ llms, sources }) => {
    const next = getLlmsModelServices(llms, sources);
    const prev = stableLlmsModelServices.current;
    if (prev
      && prev.length === next.length
      && prev.every((v, i) => shallowEquals(v, next[i]))
    ) return prev;
    return stableLlmsModelServices.current = next;
  });

  const hasProdiaModels = useProdiaStore(state => !!state.modelId);


  // memo

  const { mayWork, mayEdit, providers, activeProvider } = React.useMemo(() => {
    const { llms, sources } = llmsStoreState(); // Get all LLMs and sources/services
    const providers = getTextToImageProviders(llmsModelServices, hasProdiaModels, llms, sources);
    const activeProvider = !activeProviderId ? undefined : providers.find(p => p.providerId === activeProviderId);
    const mayWork = providers.some(p => p.configured);
    const mayEdit = activeProvider?.vendor === 'openai' && dalleModelId === 'gpt-image-1';
    return {
      mayWork,
      mayEdit,
      providers,
      activeProvider,
    };
  }, [activeProviderId, dalleModelId, hasProdiaModels, llmsModelServices]);


  // [Effect] Auto-select the first correctly configured provider
  const isConfigured = !!activeProvider;
  React.useEffect(() => {
    if (isConfigured) return;
    const autoSelectProvider = providers.find(p => p.configured);
    if (autoSelectProvider)
      useTextToImageStore.getState().setActiveProviderId(autoSelectProvider.providerId);
  }, [isConfigured, providers]);


  return {
    mayWork,
    mayEdit,
    providers,
    activeProviderId,
    setActiveProviderId: useTextToImageStore.getState().setActiveProviderId,
  };
}


// T2I API

export function getActiveTextToImageProviderOrThrow() {

  // validate active Id
  const { activeProviderId } = useTextToImageStore.getState();
  if (!activeProviderId)
    throw new Error('No TextToImage Provider selected');

  // [immediate] get all providers
  const { llms, sources: modelsServicesFromStore } = llmsStoreState(); // Renamed to avoid conflict
  const llmsModelServicesForT2I = getLlmsModelServices(llms, modelsServicesFromStore);
  const providers = getTextToImageProviders(llmsModelServicesForT2I, !!useProdiaStore.getState().modelId, llms, modelsServicesFromStore);

  // find the active provider
  const activeProvider = providers.find(p => p.providerId === activeProviderId);
  if (!activeProvider)
    throw new Error('Text-to-image is not configured correctly');

  return activeProvider;
}

async function _t2iGenerateImagesOrThrow({ providerId, vendor }: TextToImageProvider, prompt: string, aixInlineImageParts: AixParts_InlineImagePart[], count: number): Promise<T2iCreateImageOutput[]> {
  switch (vendor) {

    case 'localai':
      // if (!provider.providerId)
      //   throw new Error('No LocalAI Model service configured for TextToImage');
      // return await localaiGenerateImages(provider.id, prompt, count);
      throw new Error('LocalAI t2i integration is not yet available');

    case 'openai':
      if (!providerId)
        throw new Error('No OpenAI Model Service configured for TextToImage');
      return await openAIGenerateImagesOrThrow(providerId, prompt, aixInlineImageParts, count);

    case 'prodia':
      const hasProdiaServer = getBackendCapabilities().hasImagingProdia;
      const hasProdiaClientModels = !!useProdiaStore.getState().modelId;
      if (!hasProdiaServer && !hasProdiaClientModels)
        throw new Error('No Prodia configuration found for TextToImage');
      if (aixInlineImageParts?.length)
        throw new Error('Prodia image editing is not yet available');
      return await prodiaGenerateImages(prompt, count);

    case 'pollinations':
      if (!providerId) // Should be 'pollinations' itself or a specific model ID
        throw new Error('No Pollinations Model service configured for TextToImage');
      if (aixInlineImageParts?.length)
        throw new Error('Pollinations image editing is not yet available');

      // TODO: Get actual modelId, width, height, seed from somewhere (e.g. active model settings or UI)
      // The modelId used here should be the one without the "pollinations-" prefix.
      const anImageLLM = llmsStoreState().llms.find(m => m.vId === 'pollinations' && m.interfaces.includes('outputs-image'));
      if (!anImageLLM)
        throw new Error('No Pollinations image model found. Please update models.');

      // Extract default width/height/seed from model if available in initialParameters
      const modelWidth = anImageLLM.initialParameters?.['width'] as number | undefined;
      const modelHeight = anImageLLM.initialParameters?.['height'] as number | undefined;
      const modelSeed = anImageLLM.initialParameters?.['seed'] as number | undefined;

      const { imageUrl } = await apiAsync.llmPollinations.generateImage.mutate({
        modelId: anImageLLM.id, // This will be like 'pollinations-flux-1.0-sde'
        prompt,
        width: modelWidth, // Pass parameters from the model definition
        height: modelHeight,
        seed: modelSeed,
      });

      // Client-side fetch and conversion to base64 - less ideal but works if TRPC returns URL
      const imageResponse = await fetch(imageUrl);
      if (!imageResponse.ok)
        throw new Error(`Failed to fetch image from Pollinations URL: ${imageResponse.statusText}`);
      const imageBlob = await imageResponse.blob();
      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(imageBlob);
      });

      return [{
        mimeType: imageBlob.type || 'image/png', // Get mimeType from blob
        base64Data,
        altText: prompt,
        generatorName: anImageLLM.label || 'Pollinations', // Or model name
        // width, height, parameters, generatedAt, inputTokens, outputTokens if available
        width: modelWidth, // Assuming these are the dimensions of the generated image
        height: modelHeight,
        parameters: { model: anImageLLM.id, seed: modelSeed },
        generatedAt: Date.now(),
      }];

    case 'zhipuai':
      if (!providerId)
        throw new Error('No ZhipuAI Model service configured for TextToImage');
      if (aixInlineImageParts?.length)
        throw new Error('ZhipuAI image editing (img2img) is not yet available via this flow.');

      // providerId here is the DModelsServiceId for ZhipuAI
      const zhipuImageModel = llmsStoreState().llms.find(m => m.vId === 'zhipuai' && m.interfaces.includes('outputs-image') && m.sId === providerId);
      if (!zhipuImageModel)
        throw new Error(`ZhipuAI image model for service ${providerId} not found. Please update models.`);

      // Extract parameters for ZhipuAI
      // The model ID for the API call should not have the vendor prefix.
      const zhipuApiSpecificModelId = zhipuImageModel.id.startsWith('zhipuai-') ? zhipuImageModel.id.substring('zhipuai-'.length) : zhipuImageModel.id;
      const zhipuSize = zhipuImageModel.initialParameters?.['size'] as string || '1024x1024'; // Default if not set
      const zhipuQuality = zhipuImageModel.initialParameters?.['quality'] as string || 'standard'; // Default if not set

      // Note: ZhipuAI API key is handled by the TRPC backend via ZhipuAIAccessSchema in context
      const { imageUrl, response: zhipuResponse } = await apiAsync.llmZhipuAI.generateImage.mutate({
        model: zhipuApiSpecificModelId, // e.g., "cogview-3" (or "cogview-3-flash" depending on exact model ID from vendor)
        prompt,
        size: zhipuSize,
        quality: zhipuQuality,
        // user_id: can be added if available globally or from user settings
      });

      // Fetch image from URL and convert to base64
      const imageResp = await fetch(imageUrl);
      if (!imageResp.ok)
        throw new Error(`Failed to fetch image from ZhipuAI URL: ${imageResp.statusText}`);
      const imageBlob = await imageResp.blob();
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(imageBlob);
      });

      const width = parseInt(zhipuSize.split('*')[0]);
      const height = parseInt(zhipuSize.split('*')[1]);

      return [{
        mimeType: imageBlob.type || 'image/png',
        base64Data: base64,
        altText: prompt,
        generatorName: zhipuImageModel.label || 'ZhipuAI CogView',
        width: width,
        height: height,
        parameters: { model: zhipuImageModel.id, size: zhipuSize, quality: zhipuQuality },
        generatedAt: zhipuResponse?.created ? zhipuResponse.created * 1000 : Date.now(), // created is in seconds
      }];
  }
}

/**
 * Generate image content fragments using the provided TextToImageProvider
 * If t2iprovider is null, the active provider will be used
 */
export async function t2iGenerateImageContentFragments(
  t2iProvider: TextToImageProvider | null,
  prompt: string,
  aixInlineImageParts: AixParts_InlineImagePart[],
  count: number,
  contextId: DBlobDBContextId, scopeId: DBlobDBScopeId,
): Promise<DMessageContentFragment[]> {

  // T2I: Use the active provider if null
  if (!t2iProvider)
    t2iProvider = getActiveTextToImageProviderOrThrow();

  // T2I: Generate
  const generatedImages = await _t2iGenerateImagesOrThrow(t2iProvider, prompt, aixInlineImageParts, count);
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
        // inputTokens: _i.inputTokens,
        // outputTokens: _i.outputTokens,
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
  return services.filter(s => (s.vId === 'openai' || (T2I_ENABLE_LOCAL_AI && s.vId === 'localai'))).map((s): T2ILlmsModelServices => ({
    label: s.label,
    modelVendorId: s.vId,
    modelServiceId: s.id,
    hasAnyModels: llms.some(m => m.sId === s.id),
  }));
}

function getTextToImageProviders(llmsModelServices: T2ILlmsModelServices[], hasProdiaClientModels: boolean, llms: DLLM[], services: DModelsService[]) {
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
          painter: openAIImageModelsCurrentGeneratorName(), // sync this with dMessageUtils.tsx
          // painter: 'DALL·E',
          description: 'OpenAI Image generation models',
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

  // add Pollinations provider
  const hasPollinationsModels = llms.some(m => m.vId === 'pollinations' && m.interfaces.includes('outputs-image'));
  providers.push({
    providerId: 'pollinations', // Unique ID for this provider type
    label: 'Pollinations',
    painter: 'Pollinations', // Or a specific model family like "Flux"
    description: 'Pollinations.ai free image models',
    configured: hasPollinationsModels, // configured if we have models
    vendor: 'pollinations',
  });

  // add ZhipuAI provider
  const hasZhipuAIModels = llms.some(m => m.vId === 'zhipuai' && m.interfaces.includes('outputs-image'));
  const zhipuAIService = services.find(s => s.vId === 'zhipuai');
  providers.push({
    providerId: zhipuAIService?.id || 'zhipuai', // Use serviceId if available, fallback for safety
    label: zhipuAIService?.label || 'ZhipuAI',
    painter: 'CogView', // Or ZhipuAI
    description: 'ZhipuAI image models (CogView)',
    configured: hasZhipuAIModels && !!zhipuAIService, // Requires models and a configured service
    vendor: 'zhipuai',
  });

  return providers;
}