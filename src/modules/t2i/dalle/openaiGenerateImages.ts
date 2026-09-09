import type { AixParts_InlineImagePart } from '~/modules/aix/server/api/aix.wiretypes';

import type { DModelsServiceId } from '~/common/stores/llms/llms.service.types';
import { apiStream } from '~/common/util/trpc.client';
import { formatModelsCost } from '~/common/util/costUtils';

import type { OpenAIAccessSchema } from '~/modules/llms/server/openai/openai.access';
import { findServiceAccessOrThrow } from '~/modules/llms/vendors/vendor.helpers';

// IMPORTANT: Import TYPE (!)
import type { T2iCreateImageOutput, T2iGenerateOptions } from '../t2i.server';
import type { DalleImageQualityGI, DalleModelId, DalleModelSelection, DalleSizeGI, DProfileDalle } from '../t2i.types';
import { clampGPTImageQuality, isGPTImage25ModelId, resolveDalleModelId } from '../t2i.config';


/**
 * Client function to call the OpenAI image generation API.
 */
export async function openAIGenerateImagesOrThrow(
  modelServiceIdForAccess: DModelsServiceId,
  modelVendor: 'azure' | 'localai' | 'openai',
  profile: DProfileDalle,
  prompt: string,
  aixInlineImageParts: AixParts_InlineImagePart[],
  count: number,
  { t2iContextName, agiProfilePic, abortSignal }: T2iGenerateOptions,
): Promise<T2iCreateImageOutput[]> {

  // Use the engine's profile
  let {
    dalleModelId: dalleModelSelection,
    dalleSizeGI,
    dalleQualityGI,
    dalleBackgroundGI,
    dalleOutputFormatGI,
    dalleOutputCompressionGI,
    dalleModerationGI,
  } = profile;

  // Resolve the actual model to use (null = latest)
  let dalleModelId = resolveDalleModelId(dalleModelSelection);

  // [special] Profile pic generation mode: force gpt-image-1-mini, square, low resolution, low quality
  if (agiProfilePic) {
    dalleModelId = 'gpt-image-1-mini';
    dalleSizeGI = '1024x1024'; // square
    dalleQualityGI = 'medium'; // we're rescaling to 256x256 anyway - low is $0.005, medium is $0.011 (2x)
  }

  // [Azure, 2025-11-18] WebP is not supported
  if (modelVendor === 'azure' && dalleOutputFormatGI === 'webp')
    dalleOutputFormatGI = 'png';

  // helper to check for abort conditions and throw consistent error
  function throwIfAborted(error?: any) {
    if (abortSignal?.aborted ||
      error?.name === 'AbortError' ||
      error?.message?.includes('aborted') ||
      error?.message?.includes('BodyStreamBuffer was aborted')) {
      const abortError = new Error('Image generation was cancelled');
      abortError.name = 'AbortError';
      throw abortError;
    }
  }

  // Function to generate images in batches
  async function generateImagesBatch(imageCount: number): Promise<T2iCreateImageOutput[]> {
    throwIfAborted(); // Check before starting

    // we use an async generator to stream heartbeat events while waiting for the images
    const operations = await apiStream.llmOpenAI.createImages.mutate({
      access: findServiceAccessOrThrow<{}, OpenAIAccessSchema>(modelServiceIdForAccess).transportAccess,
      // [LocalAI, 2025-11-18] LocalAI uses the default model 'stablediffusion' and we don't have any dynamic model selection yet
      generationConfig: modelVendor === 'localai' ? {
        model: dalleModelId === 'gpt-image-1-mini' ? 'dreamshaper' : 'stablediffusion',
        prompt,
        count: imageCount,
        // [LocalAI] size mapping - FIXME! - TEMP CODE
        size: dalleSizeGI === '1024x1024' ? '512x512'
          : dalleSizeGI === '1024x1536' ? '256x256'
            : '1024x1024',
        response_format: 'b64_json',
      } : {
        model: dalleModelId,
        prompt: prompt.slice(0, 32000 - 1), // GPT Image family accepts much longer prompts
        count: imageCount,
        size: dalleSizeGI,
        quality: clampGPTImageQuality(dalleModelId, dalleQualityGI), // per-model tiers: the API 400s on unsupported ones
        background: dalleBackgroundGI,
        output_format: dalleOutputFormatGI,
        output_compression: dalleOutputCompressionGI,
        moderation: dalleModerationGI,
        // response_format: 'b64_json', unsupported, as it's the default
      },
      ...(aixInlineImageParts?.length && {
        editConfig: {
          inputImages: aixInlineImageParts,
          // maskImage: ...
        },
      }),
      t2iContextName,
    }, {
      signal: abortSignal, // aborts the tRPC request
    });

    const createdImages: T2iCreateImageOutput[] = [];
    try {
      for await (const op of operations) {
        throwIfAborted(); // Check during iteration
        if (op.p === 'createImage')
          createdImages.push(op.image);
      }
    } catch (error: any) {
      throwIfAborted(error);
      throw error; // Re-throw non-abort errors
    }

    return createdImages;
  }


  // Calculate the number of batches required (the GPT Image family accepts n up to 10)
  const maxBatchSize = 10;

  // Operate in batches of maxBatchSize
  const batchPromises: Promise<T2iCreateImageOutput[]>[] = [];
  for (let i = 0; i < count; i += maxBatchSize) {
    const batchSize = Math.min(maxBatchSize, count - i);
    batchPromises.push(generateImagesBatch(batchSize));
  }

  // Run all image generation requests in parallel and handle all results
  const imageRefsBatchesResults = await Promise.allSettled(batchPromises);


  // Throw if ALL promises were rejected
  const allRejected = imageRefsBatchesResults.every(result => result.status === 'rejected');
  if (allRejected) {

    // check if any of the rejections are AbortErrors - if so, preserve the abort nature
    const firstRejection = imageRefsBatchesResults.find(result => result.status === 'rejected') as PromiseRejectedResult;
    const firstError = firstRejection?.reason;

    // re-throw the abort error directly to preserve its nature
    if (firstError?.name === 'AbortError')
      throw firstError;

    const errorMessages = imageRefsBatchesResults
      .map(result => {
        const reason = (result as PromiseRejectedResult).reason as any; // TRPCClientError<TRPCErrorShape>;
        return reason?.shape?.message || reason?.message || '';
      })
      .filter(message => !!message)
      .join(', ');

    throw new Error(`OpenAI image generation: ${errorMessages}`);
  }

  // Take successful results and return as a flat array
  return imageRefsBatchesResults
    .filter(result => result.status === 'fulfilled')
    .map(result => (result as PromiseFulfilledResult<T2iCreateImageOutput[]>).value) // Get the value
    .flat();
}


export function openAIImageModelsGeneratorName(dalleModelSelection: DalleModelSelection) {
  const dalleModelId = resolveDalleModelId(dalleModelSelection);
  if (dalleModelId === 'gpt-image-2.5-flare') return 'GPT Image 2.5 Flare';
  if (dalleModelId === 'gpt-image-2.5-sunburst') return 'GPT Image 2.5 Sunburst';
  if (dalleModelId === 'gpt-image-2') return 'GPT Image 2';
  if (dalleModelId === 'gpt-image-1.5') return 'GPT Image 1.5';
  if (dalleModelId === 'gpt-image-1') return 'GPT Image 1';
  if (dalleModelId === 'gpt-image-1-mini') return 'GPT Image Mini';
  return 'OpenAI Image generator';
}

/**
 * Pricing data for the GPT Image family, per $1M tokens. Source: https://platform.openai.com/docs/pricing
 * Cached-input discounts exist (gpt-image-2.5/2/1.5: $2/img $1.25/txt, gpt-image-1: $2.50/img $1.25/txt,
 * gpt-image-1-mini: $0.25/img $0.20/txt) but are not tracked here yet - add when the usage field is wired up.
 */
const IMAGE_MODEL_PRICING = {
  'gpt-image-2.5-flare':    { inputText: 5.00, inputImage:  8.00, outputImage: 30.00 },
  'gpt-image-2.5-sunburst': { inputText: 5.00, inputImage:  8.00, outputImage: 30.00 },
  'gpt-image-2':            { inputText: 5.00, inputImage:  8.00, outputImage: 30.00 },
  'gpt-image-1.5':          { inputText: 5.00, inputImage:  8.00, outputImage: 32.00 },
  'gpt-image-1':            { inputText: 5.00, inputImage: 10.00, outputImage: 40.00 },
  'gpt-image-1-mini':       { inputText: 2.00, inputImage:  2.50, outputImage:  8.00 },
} as const satisfies Record<DalleModelId, { inputText: number, inputImage: number, outputImage: number }>;

/**
 * Output image tokens per quality and size - the billing basis for the GPT Image family (x outputImage price).
 * OpenAI only publishes the gpt-image-1 table; the 2.5 and 2 rows are `usage.output_tokens` measured on 2026-09-09.
 * Each generation re-ladders: gpt-image-2 'medium' = gpt-image-2.5 'high', gpt-image-2 'high' = gpt-image-2.5 'max'.
 */
type _GITokensBySize = Record<DalleSizeGI, number>; // [1024x1024, 1536x1024, 1024x1536]
const _giTok = (square: number, landscape: number, portrait: number): _GITokensBySize => ({ '1024x1024': square, '1536x1024': landscape, '1024x1536': portrait });
const GPT_IMAGE_OUTPUT_TOKENS: Record<'gpt-image-2.5' | 'gpt-image-2' | 'gpt-image-1', Partial<Record<DalleImageQualityGI, _GITokensBySize>>> = {
  'gpt-image-2.5': { // flare and sunburst bill the same
    low: _giTok(196, 158, 158),
    medium: _giTok(439, 343, 343),
    high: _giTok(1756, 1372, 1372),
    xhigh: _giTok(3122, 2459, 2459),
    max: _giTok(7024, 5488, 5488),
  },
  'gpt-image-2': {
    low: _giTok(196, 158, 158),
    medium: _giTok(1756, 1372, 1372),
    high: _giTok(7024, 5488, 5488),
  },
  'gpt-image-1': { // https://platform.openai.com/docs/guides/image-generation?image-generation-model=gpt-image-1 - also 1.5 and mini
    low: _giTok(272, 400, 408),
    medium: _giTok(1056, 1568, 1584),
    high: _giTok(4160, 6208, 6240),
  },
};

/** Estimated output-image cost for one image, from the measured token table and the per-model output price. */
export function openAIImageModelsPricing(modelId: DalleModelId, quality: DalleImageQualityGI, size: DalleSizeGI): string {

  // per-model quality tiers (e.g. gpt-image-1-mini has no 'high', 'xhigh'/'max' are 2.5 only)
  const qualityGI = clampGPTImageQuality(modelId, quality);

  const tokensTable = GPT_IMAGE_OUTPUT_TOKENS[isGPTImage25ModelId(modelId) ? 'gpt-image-2.5' : modelId === 'gpt-image-2' ? 'gpt-image-2' : 'gpt-image-1'];
  const outTokens = tokensTable[qualityGI]?.[size] ?? 0;
  if (!outTokens) {
    console.log('[DEV] No GPT Image token mapping for', modelId, qualityGI, size);
    return 'varies by size';
  }

  // gpt-image-1-mini pricing does not declare tokens, but seems to be off by 30%
  const scale = modelId === 'gpt-image-1-mini' ? 1.25 : 1.0;

  return formatModelsCost(scale * IMAGE_MODEL_PRICING[modelId].outputImage * outTokens / 1_000_000);
}