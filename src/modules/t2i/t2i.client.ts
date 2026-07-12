import * as React from 'react';
import { useShallow } from 'zustand/react/shallow';

import type { AixParts_InlineImagePart } from '~/modules/aix/server/api/aix.wiretypes';

import { addDBImageAsset, DBlobDBScopeId } from '~/common/stores/blob/dblobs-portability';
import { nanoidToUuidV4 } from '~/common/util/idUtils';

import type { CapabilityTextToImage, TextToImageProvider } from '~/common/components/useCapabilities';
import type { DModelsServiceId } from '~/common/stores/llms/llms.service.types';
import { convert_Base64WithMimeType_To_Blob } from '~/common/util/blobUtils';
import { createDMessageDataRefDBlob, createZyncAssetReferenceContentFragment, DMessageContentFragment } from '~/common/stores/chat/chat.fragments';
import { llmsStoreState, useModelsStore } from '~/common/stores/llms/store-llms';

// IMPORTANT: Import TYPE (!)
import type { T2iContextName, T2iCreateImageOutput, T2iGenerateOptions } from './t2i.server';
import type { DT2IEngineAny, DT2IEngineId } from './t2i.types';
import { getImageModelFamily, resolveDalleModelId } from './t2i.config';
import { openAIGenerateImagesOrThrow } from './dalle/openaiGenerateImages';
import { openRouterGenerateImagesOrThrow } from './openrouter/openrouterGenerateImages';
import { t2iAreCredentialsValid, t2iFindEngineById, useT2IStore } from './store-module-t2i';
import { t2iEngineGeneratorName, t2iFindVendor } from './t2i.vendors-registry';


// Capabilities API - used by Settings, and whomever wants to check if this is available

export function useCapabilityTextToImage(): CapabilityTextToImage {

  // external state - engine instances, and the LLM models (for the 'configured' state of linked engines)
  const { engines, activeEngineId } = useT2IStore(useShallow(({ engines, activeEngineId }) => ({ engines, activeEngineId })));
  // stable signature: only re-render when the set of services-with-models changes, not on every llms edit
  const servicesWithModels = useModelsStore(useShallow(state => state.sources.filter(s => state.llms.some(m => m.sId === s.id)).map(s => s.id)));


  // memo

  const { mayWork, mayEdit, providers, activeProvider } = React.useMemo(() => {
    const providers = _getTextToImageProviders(engines, servicesWithModels);
    const activeProvider = _resolveActiveT2IProvider(activeEngineId, providers);
    const mayWork = providers.some(p => p.configured);
    const activeEngine = activeProvider ? engines[activeProvider.providerId] ?? null : null;
    const mayEdit = !!activeEngine && activeEngine.vendorType === 'openai' && activeEngine.profile.dialect === 'dalle'
      && getImageModelFamily(resolveDalleModelId(activeEngine.profile.dalleModelId)) === 'gpt-image';
    return {
      mayWork,
      mayEdit,
      providers,
      activeProvider,
    };
  }, [activeEngineId, engines, servicesWithModels]);


  return {
    mayWork,
    mayEdit,
    providers,
    activeProviderId: activeProvider?.providerId || null,
    setActiveProviderId: useT2IStore.getState().setActiveEngineId,
  };
}


// T2I API

export function getActiveTextToImageProviderOrThrow() {

  // get the engines and resolve the active provider using the same pure functions as the hook
  const { engines, activeEngineId } = useT2IStore.getState();
  const { llms, sources } = llmsStoreState();
  const servicesWithModels = sources.filter(s => llms.some(m => m.sId === s.id)).map(s => s.id);
  const providers = _getTextToImageProviders(engines, servicesWithModels);
  const activeProvider = _resolveActiveT2IProvider(activeEngineId, providers);

  if (!activeProvider || !activeProvider.configured)
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
  t2iContextName: T2iContextName,
  options?: T2iGenerateOptions,
): Promise<T2iCreateImageOutput[]> {

  // use the active provider if null
  if (!provider)
    provider = getActiveTextToImageProviderOrThrow();

  // resolve the engine instance behind the provider (providerId = engineId)
  const engine = t2iFindEngineById(provider.providerId);
  if (!engine)
    throw new Error('The selected image engine is no longer available');

  // NOTE: service resolution is per-vendor-case on purpose - future engines
  // (system-provided, api-key) generate without a linked LLM service
  switch (engine.vendorType) {

    case 'azure':
    case 'localai':
    case 'openai':
      return await openAIGenerateImagesOrThrow(_engineServiceIdOrThrow(engine), engine.vendorType, engine.profile, prompt, aixInlineImageParts, count, t2iContextName, options);

    case 'openrouter':
      if (aixInlineImageParts?.length)
        throw new Error('Image transformation is not yet available with OpenRouter. Please use an OpenAI service instead.');
      return await openRouterGenerateImagesOrThrow(_engineServiceIdOrThrow(engine), engine.profile, prompt, count, t2iContextName, options);

    default:
      const _exhaustiveCheck: never = engine;
      throw new Error('Unknown T2I engine');
  }
}

/** Service-backed engines: resolve the linked LLM service id for transport access. */
function _engineServiceIdOrThrow(engine: DT2IEngineAny): DModelsServiceId {
  if (engine.credentials.type !== 'llms-service' || !engine.credentials.serviceId)
    throw new Error(`No Model service configured for ${engine.label}`);
  return engine.credentials.serviceId;
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
  t2iContextName: T2iContextName,
  abortSignal?: AbortSignal,
): Promise<DMessageContentFragment[]> {

  // T2I: Generate using low-level function
  const generatedImages = await t2iGenerateImagesOrThrow(t2iProvider, prompt, aixInlineImageParts, count, t2iContextName, { abortSignal });
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

/**
 * Build the TextToImageProvider view over the engine instances.
 * providerId is the engineId - the provider list is a UI/capability projection of the engines.
 */
function _getTextToImageProviders(engines: Record<DT2IEngineId, DT2IEngineAny>, servicesWithModels: ReadonlyArray<string>): TextToImageProvider[] {
  const providers: TextToImageProvider[] = [];

  for (const engineId in engines) {
    const engine = engines[engineId];
    if (engine.isDeleted) continue;

    const vendor = t2iFindVendor(engine.vendorType);
    if (!vendor) {
      console.error('Unknown T2I vendor', engine.vendorType);
      continue;
    }

    const serviceId = engine.credentials.type === 'llms-service' ? engine.credentials.serviceId : undefined;

    providers.push({
      providerId: engine.engineId,
      modelServiceId: serviceId,
      vendor: engine.vendorType,
      priority: vendor.priority,
      label: engine.label,
      painter: t2iEngineGeneratorName(engine), // sync this with dMessageUtils.tsx
      description: vendor.description,
      // configured: credentials resolve AND the linked service has models loaded
      configured: t2iAreCredentialsValid(engine.credentials) && (!serviceId || servicesWithModels.includes(serviceId)),
    });
  }

  // Sort providers by vendor priority (then by label for deterministic ordering)
  return providers.sort((a, b) => {
    const priorityA = a.priority ?? 999;
    const priorityB = b.priority ?? 999;
    if (priorityA !== priorityB) return priorityA - priorityB;
    return a.label.localeCompare(b.label);
  });
}

function _resolveActiveT2IProvider(userSelectedId: string | null, prioritizedProviders: TextToImageProvider[]): TextToImageProvider | null {

  // if user explicitly chose an engine, respect the choice (even if currently unconfigured)
  if (userSelectedId) {
    const chosen = prioritizedProviders.find(p => p.providerId === userSelectedId);
    if (chosen) return chosen;
  }

  // Auto-select: find highest priority configured provider (providers are already sorted),
  // falling back to any provider so the configuration UI keeps a focus
  return prioritizedProviders.find(p => p.configured) || prioritizedProviders[0] || null;
}
