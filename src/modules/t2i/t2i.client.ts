import * as React from 'react';

import type { AixParts_InlineImagePart } from '~/modules/aix/server/api/aix.wiretypes';
import type { ModelVendorId } from '~/modules/llms/vendors/vendors.registry';
import { getImageModelFamily, resolveDalleModelId, useDalleStore } from '~/modules/t2i/dalle/store-module-dalle';

import { addDBImageAsset, DBlobDBScopeId } from '~/common/stores/blob/dblobs-portability';
import { nanoidToUuidV4 } from '~/common/util/idUtils';

import type { CapabilityTextToImage, TextToImageProvider } from '~/common/components/useCapabilities';
import type { DLLM } from '~/common/stores/llms/llms.types';
import type { DModelsService, DModelsServiceId } from '~/common/stores/llms/llms.service.types';
import { convert_Base64WithMimeType_To_Blob } from '~/common/util/blobUtils';
import { createDMessageDataRefDBlob, createZyncAssetReferenceContentFragment, DMessageContentFragment } from '~/common/stores/chat/chat.fragments';
import { llmsStoreState, useModelsStore } from '~/common/stores/llms/store-llms';
import { shallowEquals } from '~/common/util/hooks/useShallowObject';

import type { T2iCreateImageOutput, T2iGenerateOptions } from './t2i.server';
import { openAIGenerateImagesOrThrow, openAIImageModelsCurrentGeneratorName } from './dalle/openaiGenerateImages';
import { useTextToImageStore } from './store-module-t2i';


// Capabilities API - used by Settings, and whomever wants to check if this is available

export function useCapabilityTextToImage(): CapabilityTextToImage {

  // external state

  const stableLlmsModelServices = React.useRef<T2ILlmsModelService[]>(undefined);
  const llmsModelServices = useModelsStore(({ llms, sources }) => {
    const next = _findLlmsT2IServices(llms, sources);
    const prev = stableLlmsModelServices.current;
    if (prev
      && prev.length === next.length
      && prev.every((v, i) => shallowEquals(v, next[i]))
    ) return prev;
    return stableLlmsModelServices.current = next;
  });

  const userProviderId = useTextToImageStore(state => state.selectedT2IProviderId);

  const dalleModelId = useDalleStore(state => state.dalleModelId);


  // memo

  const { mayWork, mayEdit, providers, activeProvider } = React.useMemo(() => {
    const providers = _getTextToImageProviders(llmsModelServices);
    const activeProvider = _resolveActiveT2IProvider(userProviderId, providers);
    const mayWork = providers.some(p => p.configured);
    const resolvedDalleModelId = resolveDalleModelId(dalleModelId);
    const family = getImageModelFamily(resolvedDalleModelId);
    const mayEdit = activeProvider?.vendor === 'openai' && family === 'gpt-image';
    return {
      mayWork,
      mayEdit,
      providers,
      activeProvider,
    };
  }, [userProviderId, dalleModelId, llmsModelServices]);


  return {
    mayWork,
    mayEdit,
    providers,
    activeProviderId: activeProvider?.providerId || null,
    setActiveProviderId: useTextToImageStore.getState().setSelectedT2IProviderId,
  };
}


// T2I API

export function getActiveTextToImageProviderOrThrow() {

  // get user selection and available providers
  const { selectedT2IProviderId } = useTextToImageStore.getState();
  const { llms, sources: modelsServices } = llmsStoreState();
  const llmsModelServiceIDs = _findLlmsT2IServices(llms, modelsServices);
  const providers = _getTextToImageProviders(llmsModelServiceIDs);

  // resolve the active provider using pure function
  const activeProvider = _resolveActiveT2IProvider(selectedT2IProviderId, providers);
  if (!activeProvider)
    throw new Error('No Text-to-Image providers are configured');

  return activeProvider;
}

/**
 * Low-level T2I generation that returns raw image outputs (base64 + metadata)
 * - NOTE: MINIMIZE - the app wants to use the other version, instead, which creates the DBlob/Assets directly
 */
export async function t2iGenerateImagesOrThrow(
  provider: TextToImageProvider | null, // null: auto-detect active provider
  prompt: string,
  aixInlineImageParts: AixParts_InlineImagePart[],
  count: number,
  options?: T2iGenerateOptions,
): Promise<T2iCreateImageOutput[]> {

  // use the active provider if null
  if (!provider)
    provider = getActiveTextToImageProviderOrThrow();

  const { vendor, modelServiceId } = provider;

  switch (vendor) {
    case 'azure':
    case 'localai':
    case 'openai':
      if (!modelServiceId)
        throw new Error(`No ${vendor} Model service configured for TextToImage`);
      return await openAIGenerateImagesOrThrow(modelServiceId, vendor, prompt, aixInlineImageParts, count, options);

    case 'googleai':
      throw new Error('Gemini Imagen integration coming soon');

    case 'xai':
      throw new Error('xAI image generation integration coming soon');

    default:
      const _exhaustiveCheck: never = vendor;
      throw new Error(`Unknown T2I vendor: ${vendor}`);
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
  scopeId: DBlobDBScopeId,
  abortSignal?: AbortSignal,
): Promise<DMessageContentFragment[]> {

  // T2I: Generate using low-level function
  const generatedImages = await t2iGenerateImagesOrThrow(t2iProvider, prompt, aixInlineImageParts, count, { abortSignal });
  if (!generatedImages?.length)
    throw new Error('No image generated');

  const imageFragments: DMessageContentFragment[] = [];
  for (const _i of generatedImages) {

    // base64 -> blob conversion
    const imageBlob = await convert_Base64WithMimeType_To_Blob(_i.base64Data, _i.mimeType, 't2iGenerateImageContentFragments');

    // NOTE: no resize/type conversion, store as-is

    // add the image to the DBlobs DB
    // FIXME: [ASSET] use the Asset Store
    const dblobAssetId = await addDBImageAsset(scopeId, imageBlob, {
      label: prompt,
      metadata: {
        width: _i.width || 0,
        height: _i.height || 0,
        // description: '',
        // inputTokens: _i.inputTokens,
        // outputTokens: _i.outputTokens,
      },
      origin: {
        ot: 'generated',
        source: 'ai-text-to-image',
        generatorName: _i.generatorName,
        prompt: _i.altText,
        parameters: _i.parameters,
        generatedAt: _i.generatedAt,
      },
    });

    // Create a Zync Image Asset Reference *Content* fragment, as this is image content from the LLM
    const zyncImageAssetFragmentWithLegacy = createZyncAssetReferenceContentFragment(
      nanoidToUuidV4(dblobAssetId, 'convert-dblob-to-dasset'),
      _i.altText || prompt, // use altText (revised prompt) if available, otherwise use the prompt
      'image',
      {
        pt: 'image_ref' as const,
        dataRef: createDMessageDataRefDBlob(dblobAssetId, imageBlob.type, imageBlob.size),
        ...(_i.altText ? { altText: _i.altText } : {}),
        ...(_i.width ? { width: _i.width } : {}),
        ...(_i.height ? { height: _i.height } : {}),
      },
    );

    imageFragments.push(zyncImageAssetFragmentWithLegacy);
  }
  return imageFragments;
}


/// Private

interface T2ILlmsModelService {
  label: string;
  modelVendorId: ModelVendorId;
  modelServiceId: DModelsServiceId;
  hasAnyModels: boolean;
}

function _findLlmsT2IServices(llms: ReadonlyArray<DLLM>, services: ReadonlyArray<DModelsService>) {
  return services
    .filter(s => ['azure', 'openai', 'localai'].includes(s.vId))
    .map((s): T2ILlmsModelService => ({
      label: s.label,
      modelVendorId: s.vId,
      modelServiceId: s.id,
      hasAnyModels: llms.some(m => m.sId === s.id),
    }));
}


function _getTextToImageProviders(llmsModelServices: T2ILlmsModelService[]) {
  const providers: TextToImageProvider[] = [];

  // add providers from model services
  for (const { modelVendorId, modelServiceId, label, hasAnyModels } of llmsModelServices) {
    switch (modelVendorId) {

      case 'azure':
        providers.push({
          providerId: modelServiceId, // identity mapping here
          modelServiceId,
          vendor: 'azure',
          priority: 30 - 2, // assuming custom Azure OpenAI configs are preferred over OpenAI
          label,
          painter: openAIImageModelsCurrentGeneratorName(), // sync this with dMessageUtils.tsx
          description: 'Azure OpenAI Image generation models',
          configured: hasAnyModels,
        });
        break;

      case 'openai':
        providers.push({
          providerId: modelServiceId, // identity mapping here
          modelServiceId,
          vendor: 'openai',
          priority: 30,
          label,
          painter: openAIImageModelsCurrentGeneratorName(), // sync this with dMessageUtils.tsx
          description: 'OpenAI Image generation models',
          configured: hasAnyModels,
        });
        break;

      case 'localai':
        providers.push({
          providerId: modelServiceId, // identity mapping here
          modelServiceId,
          vendor: 'localai',
          priority: 20, // LocalAI preferred over cloud services, if configured
          label,
          painter: 'LocalAI',
          description: 'LocalAI\'s models',
          configured: hasAnyModels,
        });
        break;

      default:
        console.error('Unknown model vendor', modelVendorId);
        break;
    }
  }

  // Insert other services here if needed (non-LLM/Service based)
  // ... (e.g. we used to have Prodia here)

  // Sort providers by vendor priority (then by label for deterministic ordering)
  return providers.sort((a, b) => {
    const priorityA = a.priority ?? 999;
    const priorityB = b.priority ?? 999;
    if (priorityA !== priorityB) return priorityA - priorityB;
    return a.label.localeCompare(b.label);
  });
}

function _resolveActiveT2IProvider(userSelectedId: string | null, prioritizedProviders: TextToImageProvider[]): TextToImageProvider | null {

  // if user explicitly chose a provider AND it's configured
  if (userSelectedId) {
    const chosen = prioritizedProviders.find(p => p.providerId === userSelectedId && p.configured);
    if (chosen) return chosen;
  }

  // Auto-select: find highest priority configured provider (providers are already sorted)
  return prioritizedProviders.find(p => p.configured) || null;
}