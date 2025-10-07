import type { AixParts_InlineImagePart } from '~/modules/aix/server/api/aix.wiretypes';

import { apiStream } from '~/common/util/trpc.client';

import type { OpenAIAccessSchema } from '../../llms/server/openai/openai.router';

import type { DModelsServiceId } from '~/common/stores/llms/llms.service.types';
import { findServiceAccessOrThrow } from '~/modules/llms/vendors/vendor.helpers';

import type { T2iCreateImageOutput } from '../t2i.server';
import { DalleImageQuality, DalleModelId, DalleSize, getImageModelFamily, resolveDalleModelId, useDalleStore } from './store-module-dalle';
import {
  formatModelsCost
} from '~/common/util/costUtils';


/**
 * Client function to call the OpenAI image generation API.
 */
export async function openAIGenerateImagesOrThrow(modelServiceId: DModelsServiceId, prompt: string, aixInlineImageParts: AixParts_InlineImagePart[], count: number): Promise<T2iCreateImageOutput[]> {

  // Use the current settings
  const {
    dalleModelId: dalleModelSelection,
    dalleNoRewrite,
    // -- GI
    dalleSizeGI,
    dalleQualityGI,
    dalleBackgroundGI,
    dalleOutputFormatGI,
    dalleOutputCompressionGI,
    dalleModerationGI,
    // -- D3
    dalleSizeD3,
    dalleQualityD3,
    dalleStyleD3,
    // -- D2
    dalleSizeD2,
  } = useDalleStore.getState();

  // Resolve the actual model to use (null = latest)
  const dalleModelId = resolveDalleModelId(dalleModelSelection);

  // This trick is explained on: https://platform.openai.com/docs/guides/images/usage?context=node
  if (dalleNoRewrite && (dalleModelId === 'dall-e-3' || dalleModelId === 'dall-e-2'))
    prompt = 'I NEED to test how the tool works with extremely simple prompts. DO NOT add any detail, just use it AS-IS: ' + prompt;

  // Warn about a misconfiguration
  if (aixInlineImageParts?.length && (dalleModelId === 'dall-e-3' || dalleModelId === 'dall-e-2'))
    throw new Error('Image transformation is not available with this model. Please use GPT Image or GPT Image Mini instead.');

  // Function to generate images in batches
  async function generateImagesBatch(imageCount: number): Promise<T2iCreateImageOutput[]> {

    // we use an async generator to stream heartbeat events while waiting for the images
    const operations = await apiStream.llmOpenAI.createImages.mutate({
      access: findServiceAccessOrThrow<{}, OpenAIAccessSchema>(modelServiceId).transportAccess,
      generationConfig: getImageModelFamily(dalleModelId) === 'gpt-image' ? {
        model: dalleModelId as 'gpt-image-1' | 'gpt-image-1-mini', // gpt-image-1 or gpt-image-1-mini
        prompt: prompt.slice(0, 32000 - 1), // GPT Image family accepts much longer prompts
        count: imageCount,
        size: dalleSizeGI,
        quality: dalleQualityGI,
        background: dalleBackgroundGI,
        output_format: dalleOutputFormatGI,
        output_compression: dalleOutputCompressionGI,
        moderation: dalleModerationGI,
        // response_format: 'b64_json', unsupported, as it's the default
      } : dalleModelId === 'dall-e-3' ? {
        model: 'dall-e-3',
        prompt: prompt.slice(0, 4000 - 1), // DALL-E 3 has a 4000 char limit
        count: imageCount,
        size: dalleSizeD3,
        quality: dalleQualityD3,
        style: dalleStyleD3,
        response_format: 'b64_json',
      } : {
        model: 'dall-e-2',
        prompt: prompt.slice(0, 1000 - 1), // DALL-E 2 has a 1000 char limit
        count: imageCount,
        quality: 'standard',
        size: dalleSizeD2,
        response_format: 'b64_json',
      },
      ...(aixInlineImageParts?.length && {
        editConfig: {
          inputImages: aixInlineImageParts,
          // maskImage: ...
        },
      }),
    });

    const createdImages: T2iCreateImageOutput[] = [];
    for await (const op of operations)
      if (op.p === 'createImage')
        createdImages.push(op.image);

    return createdImages;
  }


  // Calculate the number of batches required
  const family = getImageModelFamily(dalleModelId);
  const maxBatchSize = family === 'dall-e-3' ? 1 : 10; // DALL-E 3 only supports n=1, so we parallelize the requests instead. GPT Image family and DALL-E 2 support up to 10.

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


export function openAIImageModelsCurrentGeneratorName() {
  const dalleModelSelection = useDalleStore.getState().dalleModelId;
  const dalleModelId = resolveDalleModelId(dalleModelSelection);
  if (dalleModelId === 'gpt-image-1') return 'GPT Image';
  if (dalleModelId === 'gpt-image-1-mini') return 'GPT Image Mini';
  if (dalleModelId === 'dall-e-3') return 'DALL·E 3';
  if (dalleModelId === 'dall-e-2') return 'DALL·E 2';
  return 'OpenAI Image generator';
}

/**
 * Pricing data for OpenAI image models (per 1M tokens/images)
 * Source: https://platform.openai.com/docs/pricing
 *
 * TODO: When adding credit-based pricing for big-agi hosted service:
 * - Add 'credits' pricing type alongside 'token-based' and 'fixed'
 * - Server-side validation of user credits before generation
 * - Deduct credits after successful generation
 */
const IMAGE_MODEL_PRICING = {
  // Token-based pricing (GPT Image family)
  'gpt-image-1': { inputText: 5.00, inputImage: 10.0, outputImage: 40.0 },
  'gpt-image-1-mini': { inputText: 2.00, inputImage: 2.50, outputImage: 8.00 },
  // Fixed pricing models handled separately in openAIImageModelsPricing()
  'dall-e-3': null,
  'dall-e-2': null,
} as const;

function openAIImageModelsPrice(modelId: DalleModelId): undefined | { inputText: number, inputImage: number, outputImage: number } {
  return IMAGE_MODEL_PRICING[modelId] || undefined;
}

/**
 * Return the pricing for the OpenAI image generation API.
 * TODO: update this when the OpenAI pricing changes.
 */
export function openAIImageModelsPricing(modelId: DalleModelId, quality: DalleImageQuality, size: DalleSize): string {
  // GPT Image family (gpt-image-1, gpt-image-1-mini, future: gpt-image-2, etc.)
  if (modelId === 'gpt-image-1' || modelId === 'gpt-image-1-mini') {

    // gpt-image-1-mini does not support high quality
    if (modelId === 'gpt-image-1-mini' && quality === 'high') quality = 'medium';

    // GPT-Image output tokens table (same for all models in family)
    // https://platform.openai.com/docs/guides/image-generation?image-generation-model=gpt-image-1
    // NOTE: when size='auto', assume the largest size
    let outTokens = 0;
    if (quality === 'high') {
      if (size === '1024x1024') outTokens = 4160;
      else if (size === '1024x1536') outTokens = 6240;
      else if (size === '1536x1024' /*|| size === 'auto'*/) outTokens = 6208;
    } else if (quality === 'medium') {
      if (size === '1024x1024') outTokens = 1056;
      else if (size === '1024x1536') outTokens = 1584;
      else if (size === '1536x1024' /*|| size === 'auto'*/) outTokens = 1568;
    } else if (quality === 'low') {
      if (size === '1024x1024') outTokens = 272;
      else if (size === '1024x1536') outTokens = 408;
      else if (size === '1536x1024' /*|| size === 'auto'*/) outTokens = 400;
    }

    // gpt-image-1-mini pricing does not declare tokens, but seems to be off by 30%
    const scale = modelId === 'gpt-image-1-mini' ? 1.25 : 1.0;

    if (!outTokens) {
      console.log('[DEV] No GPT Image token mapping for', modelId, quality, size);
      return 'varies by size';
    }
    const price = openAIImageModelsPrice(modelId);
    if (!price || !price.outputImage) {
      console.warn('[DEV] No GPT Image pricing found for', modelId, quality, size);
      return 'varies by tokens';
    }
    const outputImageCost = scale * price.outputImage * outTokens / 1_000_000;
    return formatModelsCost(outputImageCost);
    // return outputImageCost.toFixed(2) + ' +'; // e.g. 0.17 for high/square with gpt-image-1, 0.03 for gpt-image-1-mini
  } else if (modelId === 'dall-e-3') {
    if (quality === 'hd') {
      if (size === '1024x1024') return '0.08';
      if (size === '1792x1024' || size === '1024x1792') return '0.12';
    } else if (quality === 'standard') {
      if (size === '1024x1024') return '0.04';
      if (size === '1792x1024' || size === '1024x1792') return '0.08';
    }
  } else if (modelId === 'dall-e-2') {
    if (size === '256x256') return '0.016';
    if (size === '512x512') return '0.018';
    if (size === '1024x1024') return '0.02';
  }
  return '?';
}