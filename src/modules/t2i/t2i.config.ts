import type { DalleImageSize, DalleModelId, DalleModelSelection, DProfileDalle } from './t2i.types';


// --- OpenAI/DALL·E-protocol model catalog helpers ---

export const DALLE_DEFAULT_IMAGE_SIZE: DalleImageSize = '1024x1024'; // this works in all

/**
 * Resolve the actual DALL-E model to use
 * @param selection - User's selection (null = auto-select latest)
 * @returns The concrete model ID to use
 */
export function resolveDalleModelId(selection: DalleModelSelection): DalleModelId {
  // Auto-select latest model when null
  if (selection === null) {
    return 'gpt-image-2'; // Current latest image drawing model
  }
  return selection;
}

/**
 * Get the model family for a given image model.
 * Models in the same family share settings, capabilities, and UI.
 *
 * @param modelId - The specific model ID
 * @returns The model family identifier
 *
 * Future: When adding new model families (e.g. Google Imagen, xAI):
 * - Add new return types: 'google-imagen' | 'xai-grok-image'
 * - Update all family-based checks to handle new families
 * - Each family can have its own settings/pricing structure
 */
export function getImageModelFamily(modelId: DalleModelId): 'gpt-image' | 'dall-e-3' | 'dall-e-2' {
  if (modelId === 'gpt-image-2' || modelId === 'gpt-image-1.5' || modelId === 'gpt-image-1' || modelId === 'gpt-image-1-mini')
    return 'gpt-image';
  if (modelId === 'dall-e-3')
    return 'dall-e-3';
  return 'dall-e-2';
}

/** Default profile for the openai/azure/localai (DALL·E-protocol) vendors. */
export function t2iDefaultDalleProfile(): DProfileDalle {
  return {
    dialect: 'dalle',
    dalleModelId: null, // auto-select latest
    dalleNoRewrite: false,
    dalleSizeGI: '1024x1024',
    dalleQualityGI: 'high',
    dalleBackgroundGI: 'auto',
    dalleOutputFormatGI: 'webp',
    dalleOutputCompressionGI: 100,
    dalleModerationGI: 'low',
    dalleSizeD3: '1024x1024',
    dalleQualityD3: 'hd',
    dalleStyleD3: 'vivid',
    dalleSizeD2: '1024x1024',
  };
}


// --- OpenRouter image model catalog ---

// NOTE: starter set of image generation models available through the OpenRouter
//       dedicated image API (POST /api/v1/images). The full list is at
//       https://openrouter.ai/models?fmt=cards&output_modalities=image
//       All ids verified live against GET /api/v1/images/models on 2026-07-11 (39 models
//       available); dynamic listing via that endpoint should replace this list eventually.

export const OPENROUTER_IMAGE_MODELS: { value: string, label: string }[] = [
  { value: 'google/gemini-3-pro-image', label: 'Gemini 3 Pro Image (Nano Banana Pro)' },
  { value: 'google/gemini-3.1-flash-image', label: 'Gemini 3.1 Flash Image' },
  { value: 'google/gemini-2.5-flash-image', label: 'Gemini 2.5 Flash Image (Nano Banana)' },
  { value: 'openai/gpt-image-2', label: 'GPT Image 2' },
  { value: 'openai/gpt-image-1-mini', label: 'GPT Image 1 Mini' },
  { value: 'black-forest-labs/flux.2-max', label: 'FLUX.2 Max' },
  { value: 'black-forest-labs/flux.2-pro', label: 'FLUX.2 Pro' },
  { value: 'bytedance-seed/seedream-4.5', label: 'Seedream 4.5' },
  { value: 'microsoft/mai-image-2.5', label: 'MAI Image 2.5' },
  { value: 'recraft/recraft-v4', label: 'Recraft V4' },
  { value: 'sourceful/riverflow-v2.5-pro', label: 'Riverflow V2.5 Pro' },
];

/**
 * Resolve the actual OpenRouter image model to use
 * @param selection - User's selection (null/undefined = auto = first model in the list)
 * @returns The concrete model ID to use
 */
export function resolveOpenRouterImageModelId(selection: string | null): string {
  return selection ?? OPENROUTER_IMAGE_MODELS[0].value;
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
    || generatorName.startsWith('DALL·E')
    || generatorName === 'LocalAI'
    || generatorName === 'Prodia' // legacy painter
    || OPENROUTER_IMAGE_MODELS.some(m => m.label === generatorName); // OpenRouter painters are the model labels
}
