import { modelPickOrAuto } from '~/common/util/modelPickUtils';

import type { DalleImageQualityGI, DalleModelId, DalleModelSelection, DalleSizeGI, DProfileDalle } from './t2i.types';


// configuration
export const DALLE_DEFAULT_MODEL_ID: DalleModelId = 'gpt-image-2.5-flare'; // 'Auto' selection, and fallback when none is set
export const DALLE_DEFAULT_IMAGE_SIZE: DalleSizeGI = '1024x1024';


// --- OpenAI/DALL·E-protocol model catalog helpers ---

/**
 * Resolve the actual DALL-E model to use
 * @param selection - User's selection (null = auto-select latest; a retired id resolves as auto too - see modelPickOrAuto)
 * @returns The concrete model ID to use
 */
export function resolveDalleModelId(selection: DalleModelSelection): DalleModelId {
  return modelPickOrAuto(selection, DALLE_MODEL_IDS) ?? DALLE_DEFAULT_MODEL_ID;
}

export const DALLE_MODEL_IDS: readonly DalleModelId[] = ['gpt-image-2.5-flare', 'gpt-image-2.5-sunburst', 'gpt-image-2', 'gpt-image-1.5', 'gpt-image-1', 'gpt-image-1-mini'];

/** Persisted profiles may carry retired ids (e.g. dall-e-3) - the store migration nulls them, this is the runtime guard. */
export function isDalleModelId(modelId: unknown): modelId is DalleModelId {
  return (DALLE_MODEL_IDS as readonly unknown[]).includes(modelId);
}

/** gpt-image-2.5 (flare, sunburst): 'xhigh' and 'max' quality tiers, arbitrary sizes (not exposed yet) */
export function isGPTImage25ModelId(modelId: DalleModelId): boolean {
  return modelId === 'gpt-image-2.5-flare' || modelId === 'gpt-image-2.5-sunburst';
}

/**
 * Clamp a GPT Image quality to what the model accepts - the API returns 400 otherwise.
 * Verified 2026-09-09: 'xhigh'/'max' rejected by gpt-image-2 and older; gpt-image-1-mini has no 'high'.
 */
export function clampGPTImageQuality(modelId: DalleModelId, quality: DalleImageQualityGI): DalleImageQualityGI {
  if ((quality === 'xhigh' || quality === 'max') && !isGPTImage25ModelId(modelId))
    return 'high';
  if (quality === 'high' && modelId === 'gpt-image-1-mini')
    return 'medium';
  return quality;
}

/** Default profile for the openai/azure/localai (DALL·E-protocol) vendors. */
export function t2iDefaultDalleProfile(): DProfileDalle {
  return {
    dialect: 'dalle',
    dalleModelId: null, // auto-select latest
    dalleSizeGI: '1024x1024',
    dalleQualityGI: 'high',
    dalleBackgroundGI: 'auto',
    dalleOutputFormatGI: 'webp',
    dalleOutputCompressionGI: 100,
    dalleModerationGI: 'low',
  };
}


// --- OpenRouter image model catalog ---

// NOTE: starter set of image generation models available through the OpenRouter
//       dedicated image API (POST /api/v1/images). The full list is at
//       https://openrouter.ai/models?fmt=cards&output_modalities=image
//       All ids verified live against GET /api/v1/images/models on 2026-10-06 (59 models
//       available); dynamic listing via that endpoint should replace this list eventually.
//       The first entry is Auto; a pick removed here resolves as Auto (resolveOpenRouterImageModelId).

export const OPENROUTER_IMAGE_MODELS: { value: string, label: string }[] = [
  { value: 'google/gemini-3-pro-image', label: 'Gemini 3 Pro Image (Nano Banana Pro)' },
  { value: 'google/gemini-nano-banana-2.1', label: 'Nano Banana 2.1' },
  { value: 'google/gemini-3.1-flash-lite-image', label: 'Nano Banana 2 Lite' },
  { value: 'google/gemini-3.1-flash-image', label: 'Gemini 3.1 Flash Image' }, // shutdown 2026-10-29 -> Nano Banana 2.1
  { value: 'openai/gpt-image-2.5-flare', label: 'GPT Image 2.5 Flare' },
  { value: 'openai/gpt-image-1-mini', label: 'GPT Image 1 Mini' },
  { value: 'black-forest-labs/flux.2-max', label: 'FLUX.2 Max' },
  { value: 'black-forest-labs/flux.2-pro', label: 'FLUX.2 Pro' },
  { value: 'bytedance-seed/seedream-4.5', label: 'Seedream 4.5' },
  { value: 'microsoft/mai-image-2.5', label: 'MAI Image 2.5' },
  { value: 'recraft/recraft-v4', label: 'Recraft V4' },
  { value: 'sourceful/riverflow-v2.5-pro', label: 'Riverflow V2.5 Pro' },
];

export const OPENROUTER_IMAGE_MODEL_IDS: readonly string[] = OPENROUTER_IMAGE_MODELS.map(m => m.value);

/**
 * Resolve the actual OpenRouter image model to use
 * @param selection - User's selection (null/undefined = auto = first model in the list; a pick no longer listed resolves as auto too)
 * @returns The concrete model ID to use
 */
export function resolveOpenRouterImageModelId(selection: string | null): string {
  return modelPickOrAuto(selection, OPENROUTER_IMAGE_MODEL_IDS) ?? OPENROUTER_IMAGE_MODEL_IDS[0];
}

export function openRouterImageModelLabel(modelId: string | null): string {
  const resolved = resolveOpenRouterImageModelId(modelId);
  return OPENROUTER_IMAGE_MODELS.find(m => m.value === resolved)?.label || resolved;
}


// --- Painter names ---

/**
 * Whether a message generator name is a T2I painter, i.e. the message was image-generated.
 * Painter names are produced by the vendors' generatorName() - this is the single
 * place that recognizes them (e.g. for the message avatar), so adding a vendor
 * does not require touching the message rendering code.
 */
export function t2iIsPainterName(generatorName: string | undefined): boolean {
  if (!generatorName) return false;
  return generatorName.startsWith('GPT Image')
    || generatorName.startsWith('DALL·E') // retired painter, still in message history
    || generatorName === 'LocalAI'
    || generatorName === 'Prodia' // legacy painter
    || generatorName === 'Gemini 2.5 Flash Image (Nano Banana)' // retired OpenRouter painter, still in message history
    || generatorName.startsWith('Nano Banana') // Gemini painters are the model labels
    || OPENROUTER_IMAGE_MODELS.some(m => m.label === generatorName); // OpenRouter painters are the model labels
}
