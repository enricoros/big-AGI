import { DPricingChatGenerate, getLlmCostForTokens, isModelPricingFree } from '~/common/stores/llms/llms.pricing';

/**
 * This is a stored type - IMPORTANT: do not break.
 * - stored by DMessage > DMessageGenerator
 */
export type DMetricsChatGenerate_Md =
  Omit<MetricsChatGenerateTokens, 'T'> &
  MetricsChatGenerateCost_Md;

/**
 * In particular this is used 'as' AixWire_Particles.CGSelectMetrics
 */
export type DMetricsChatGenerate_Lg =
  MetricsChatGenerateTokens &
  MetricsChatGenerateTime &
  MetricsChatGenerateCost_Md;


type MetricsChatGenerateTokens = {
  // T = Tokens
  T?: number,
  TIn?: number,         // Portion of Input tokens which is new (not cached)
  TCacheRead?: number,
  TCacheWrite?: number,
  TOut?: number,
  TOutR?: number,       // Portion of TOut that was used for reasoning (e.g. not for output)
  // TOutA?: number,    // Portion of TOut that was used for Audio

  // If set, indicates unreliability or stop reason
  TsR?:
    | 'pending'         // still being generated (could be stuck in this state if data got corrupted)
    | 'aborted'         // aborted or failed (interrupted generation, out of tokens, connection error, etc)
}


type MetricsChatGenerateTime = {
  // dt = milliseconds
  dtStart?: number,
  dtInner?: number,
  dtAll?: number,

  // v = Tokens/s
  vTOutInner?: number,  // TOut / dtInner
  vTOutAll?: number,    // TOut / dtAll
}


export type MetricsChatGenerateCost_Md = {
  // $c = Cents of USD - NOTE: we chose to use cents to reduce floating point errors
  $c?: number,
  $cdCache?: number,
  $code?:
    | 'free'            // generated for free
    | 'partial-msg'     // partial message generated
    | 'partial-price'   // partial pricing available
    | 'no-pricing'      // model pricing not available
    | 'no-tokens'       // tokens are missing from the metrics
}


// ChatGenerate token metrics

export function metricsPendChatGenerateLg(metrics: DMetricsChatGenerate_Lg | undefined): void {
  if (metrics)
    metrics.TsR = 'pending';
}

export function metricsFinishChatGenerateLg(metrics: DMetricsChatGenerate_Lg | undefined, isAborted: boolean): void {
  if (!metrics) return;

  // remove the previous TsR if it was 'pending'
  delete metrics.TsR;
  if (isAborted)
    metrics.TsR = 'aborted';

  // sum up the Tokens
  if (!metrics.T)
    metrics.T = (metrics.TIn || 0) + (metrics.TOut || 0) + (metrics.TCacheRead || 0) + (metrics.TCacheWrite || 0);

  // calculate the outer Token velocity
  if (metrics.TOut !== undefined && metrics.dtAll !== undefined && metrics.dtAll > 0)
    metrics.vTOutAll = Math.round(100 * metrics.TOut / (metrics.dtAll / 1000)) / 100;
}


// ChatGenerate cost metrics

const USD_TO_CENTS = 100;

export function metricsComputeChatGenerateCostsMd(metrics?: Readonly<DMetricsChatGenerate_Md>, pricing?: DPricingChatGenerate | undefined, logLlmRefId?: string): MetricsChatGenerateCost_Md | undefined {
  if (!metrics)
    return undefined;

  // metrics: token presence
  const inNewTokens = metrics.TIn || 0;
  const inCacheReadTokens = metrics.TCacheRead || 0;
  const inCacheWriteTokens = metrics.TCacheWrite || 0;
  const sumInputTokens = inNewTokens + inCacheReadTokens + inCacheWriteTokens;
  const outTokens = metrics.TOut || 0;

  // usage: presence
  if (!sumInputTokens && !outTokens)
    return { $code: 'no-tokens' };

  // pricing: presence
  if (!pricing)
    return { $code: 'no-pricing' };

  // pricing: bail if free
  if (isModelPricingFree(pricing))
    return { $code: 'free' };


  // partial pricing
  const isPartialMessage = metrics.TsR === 'pending' || metrics.TsR === 'aborted';

  // Calculate costs
  const tierTokens = sumInputTokens;
  const $inNew = getLlmCostForTokens(tierTokens, inNewTokens, pricing.input);
  const $out = getLlmCostForTokens(tierTokens, outTokens, pricing.output);
  if ($inNew === undefined || $out === undefined) {
    // many llms don't have pricing information, so the cost computation ends here
    return { $code: 'partial-price' };
  }


  // Standard price
  const $noCacheRounded = Math.round(($inNew + $out) * USD_TO_CENTS * 10000) / 10000;
  if (!inCacheReadTokens && !inCacheWriteTokens)
    return { $c: $noCacheRounded, ...(isPartialMessage && { $code: 'partial-msg' }) };


  // Price with Caching
  const cachePricing = pricing.cache;
  if (!cachePricing) {
    console.log(`No cache pricing for ${logLlmRefId}`);
    return { $c: $noCacheRounded, $code: 'partial-price' };
  }

  // 2024-08-22: DEV Note: we put this here to break in case we start having tiered price with cache,
  // for which we don't know if the tier discriminator is the input tokens level, or the equivalent
  // tokens level (input + cache)
  if (Array.isArray(cachePricing.read) || ('write' in cachePricing && Array.isArray(cachePricing.write)))
    throw new Error('Tiered pricing with cache is not supported');

  // compute the input cache read costs
  const $cacheRead = getLlmCostForTokens(tierTokens, inCacheReadTokens, cachePricing.read);
  if ($cacheRead === undefined) {
    console.log(`Missing cache read pricing for ${logLlmRefId}`);
    return { $c: $noCacheRounded, $code: 'partial-price' };
  }

  // compute the input cache write costs
  let $cacheWrite;
  switch (cachePricing.cType) {
    case 'ant-bp':
      $cacheWrite = getLlmCostForTokens(tierTokens, inCacheWriteTokens, cachePricing.write);
      break;
    case 'oai-ac':
      $cacheWrite = 0;
      break;
    default:
      throw new Error('computeChatGenerationCosts: Unknown cache type');
  }
  if ($cacheWrite === undefined) {
    console.log(`Missing cache write pricing for ${logLlmRefId}`);
    return { $c: $noCacheRounded, $code: 'partial-price' };
  }

  // compute the cost for this call
  const $c = Math.round(($inNew + $cacheRead + $cacheWrite + $out) * USD_TO_CENTS * 10000) / 10000;

  // compute the advantage from caching
  const $inAsIfNoCache = getLlmCostForTokens(tierTokens, sumInputTokens, pricing.input)!;
  const $cdCache = Math.round(($inAsIfNoCache - $inNew - $cacheRead - $cacheWrite) * USD_TO_CENTS * 10000) / 10000;

  // mark the costs as partial if the message was not completely received - i.e. the server did not tell us the final tokens count
  return {
    $c,
    $cdCache,
    ...(isPartialMessage && { $code: 'partial-msg' }),
  };
}


// ChatGenerate extraction for DMessage's smaller metrics

export function metricsChatGenerateLgToMd(metrics: DMetricsChatGenerate_Lg): DMetricsChatGenerate_Md {
  const keys: (keyof DMetricsChatGenerate_Md)[] = ['$c', '$cdCache', '$code', 'TIn', 'TCacheRead', 'TCacheWrite', 'TOut', 'TOutR', /*TOutA,*/ 'TsR'] as const;
  const extracted: DMetricsChatGenerate_Md = {};

  for (const key of keys) {

    // [OpenAI] we also ignore a TOutR of 0, as networks without reasoning return it. keeping it would be misleading as 'didn't reason but I could have', while it's 'can't reason'
    if (key === 'TOutR' && metrics.TOutR === 0)
      continue;

    // [OpenAI] we also ignore a TOutA of 0 (no audio in this output)
    // if (key === 'TOutA' && metrics.TOutA === 0)
    //   continue;

    if (metrics[key] !== undefined) {
      extracted[key] = metrics[key] as any;
    }
  }

  return extracted;
}