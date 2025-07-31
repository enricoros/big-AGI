import * as React from 'react';

import type { AixParts_InlineImagePart } from '~/modules/aix/server/api/aix.wiretypes';
import type { ModelVendorId } from '~/modules/llms/vendors/vendors.registry';
import { resolveDalleModelId, useDalleStore } from '~/modules/t2i/dalle/store-module-dalle';

import { addDBImageAsset, DBlobDBScopeId } from '~/common/stores/blob/dblobs-portability';
import { nanoidToUuidV4 } from '~/common/util/idUtils';

import type { CapabilityTextToImage, TextToImageProvider } from '~/common/components/useCapabilities';
import type { DLLM } from '~/common/stores/llms/llms.types';
import type { DModelsService, DModelsServiceId } from '~/common/stores/llms/llms.service.types';
import { convert_Base64WithMimeType_To_Blob } from '~/common/util/blobUtils';
import { createDMessageDataRefDBlob, createZyncAssetReferenceContentFragment, DMessageContentFragment } from '~/common/stores/chat/chat.fragments';
import { llmsStoreState, useModelsStore } from '~/common/stores/llms/store-llms';
import { shallowEquals } from '~/common/util/hooks/useShallowObject';

import type { T2iCreateImageOutput } from './t2i.server';
import { openAIGenerateImagesOrThrow, openAIImageModelsCurrentGeneratorName } from './dalle/openaiGenerateImages';
import { useTextToImageStore } from './store-module-t2i';


// configuration
const T2I_ENABLE_LOCAL_AI = false; // Note: LocalAI t2i integration is experimental


// Capabilities API - used by Settings, and whomever wants to check if this is available

export function useCapabilityTextToImage(): CapabilityTextToImage {

  // external state

  const stableLlmsModelServices = React.useRef<T2ILlmsModelServices[]>(undefined);
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
    const mayEdit = activeProvider?.vendor === 'openai' && resolvedDalleModelId === 'gpt-image-1';
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

async function _t2iGenerateImagesOrThrow({ providerId, vendor }: TextToImageProvider, prompt: string, aixInlineImageParts: AixParts_InlineImagePart[], count: number): Promise<T2iCreateImageOutput[]> {
  switch (vendor) {

    case 'gemini':
      throw new Error('Gemini Imagen integration coming soon');

    case 'localai':
      // if (!provider.providerId)
      //   throw new Error('No LocalAI Model service configured for TextToImage');
      // return await localaiGenerateImages(provider.id, prompt, count);
      throw new Error('LocalAI t2i integration is not yet available');

    case 'openai':
      if (!providerId)
        throw new Error('No OpenAI Model Service configured for TextToImage');
      return await openAIGenerateImagesOrThrow(providerId, prompt, aixInlineImageParts, count);

    case 'xai':
      throw new Error('xAI image generation integration coming soon');

    default:
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
      }
    );

    imageFragments.push(zyncImageAssetFragmentWithLegacy);
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

function _findLlmsT2IServices(llms: ReadonlyArray<DLLM>, services: ReadonlyArray<DModelsService>) {
  return services
    .filter(s => (s.vId === 'openai' || (T2I_ENABLE_LOCAL_AI && s.vId === 'localai')))
    .map((s): T2ILlmsModelServices => ({
      label: s.label,
      modelVendorId: s.vId,
      modelServiceId: s.id,
      hasAnyModels: llms.some(m => m.sId === s.id),
    }));
}


// Vendor priority system for auto-selection (lower number = higher priority)
const T2I_VENDOR_PRIORITIES = {
  openai: 1,    // highest priority (mature, reliable)
  gemini: 2,    // second (Google Imagen - future)
  xai: 3,       // third (Grok vision - future reference)
  localai: 9,   // lowest (experimental)
} as const;


function _getTextToImageProviders(llmsModelServices: T2ILlmsModelServices[]) {
  const providers: TextToImageProvider[] = [];

  // add providers from model services
  for (const { modelVendorId, modelServiceId, label, hasAnyModels } of llmsModelServices) {
    switch (modelVendorId) {

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

      default:
        console.error('Unknown model vendor', modelVendorId);
        break;
    }
  }

  // Insert other services here if needed (non-LLM/Service based)
  // ... (e.g. we used to have Prodia here)

  // Sort providers by vendor priority (then by label for deterministic ordering)
  return providers.sort((a, b) => {
    const priorityA = T2I_VENDOR_PRIORITIES[a.vendor] ?? 999;
    const priorityB = T2I_VENDOR_PRIORITIES[b.vendor] ?? 999;
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