import { DChatGeneratePricing, getLlmPriceForTokens, isModelPriceFree } from '~/common/stores/llms/llms.pricing';


/**
 * This is a stored type - IMPORTANT: do not break.
 * In particular this is used 'as' AixWire_Particles.CGSelectMetrics
 */
export type DChatGenerateMetricsLg =
  ChatGenerateTokenMetrics &
  ChatGenerateTimeMetrics &
  ChatGenerateCostMetricsMd;

export type DChatGenerateMetricsMd =
  Omit<ChatGenerateTokenMetrics, 'T'> &
  ChatGenerateCostMetricsMd;


type ChatGenerateTokenMetrics = {
  // T = Tokens
  T?: number,
  TIn?: number,
  TCacheRead?: number,
  TCacheWrite?: number,
  TOut?: number,
  TOutR?: number,       // TOut that was used for reasoning (e.g. not for output)

  // If set, indicates unreliability or stop reason
  TsR?:
    | 'pending'         // still being generated (could be stuck in this state if data got corrupted)
    | 'aborted'         // aborted or failed (interrupted generation, out of tokens, connection error, etc)
}


type ChatGenerateTimeMetrics = {
  // dt = milliseconds
  dtStart?: number,
  dtInner?: number,
  dtAll?: number,

  // v = Tokens/s
  vTOutInner?: number,  // TOut / dtInner
  vTOutAll?: number,    // TOut / dtAll
}


export type ChatGenerateCostMetricsMd = {
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

export function pendChatGenerateTokenMetrics(metrics: DChatGenerateMetricsLg | undefined): void {
  if (metrics)
    metrics.TsR = 'pending';
}

export function finishChatGenerateTokenMetrics(metrics: DChatGenerateMetricsLg | undefined, isAborted: boolean): void {
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

export function computeChatGenerationCosts(metrics?: Readonly<DChatGenerateMetricsMd>, pricing?: DChatGeneratePricing): ChatGenerateCostMetricsMd | undefined {
  if (!metrics)
    return undefined;

  // metrics: token presence
  const inputTokens = metrics.TIn || 0;
  const outputTokens = metrics.TOut || 0;
  const cacheReadTokens = metrics.TCacheRead || 0;
  const cacheWriteTokens = metrics.TCacheWrite || 0;
  const totalTokens = inputTokens + outputTokens + cacheReadTokens + cacheWriteTokens;
  if (!totalTokens)
    return { $code: 'no-tokens' };

  // pricing: presence
  if (!pricing)
    return { $code: 'no-pricing' };

  // pricing: bail if free
  if (isModelPriceFree(pricing))
    return { $code: 'free' };


  // partial pricing
  const isPartialMessage = metrics.TsR === 'pending' || metrics.TsR === 'aborted';

  // Calculate costs
  const $in = getLlmPriceForTokens(inputTokens, inputTokens, pricing.input);
  const $out = getLlmPriceForTokens(inputTokens, outputTokens, pricing.output);
  if ($in === undefined || $out === undefined)
    return { $code: 'partial-price' };

  // handle price with cache
  if (cacheReadTokens || cacheWriteTokens) {

    // 2024-08-22: DEV Note: we put this here to break in case we start having tiered price with cache,
    // for which we don't know if the tier discriminator is the input tokens level, or the equivalent
    // tokens level (input + cache)
    if (Array.isArray(pricing.cache?.read) || Array.isArray(pricing.cache?.write))
      throw new Error('Tiered pricing with cache is not supported');

    const inputNoCache = inputTokens + cacheReadTokens + cacheWriteTokens;
    const $cacheRead = getLlmPriceForTokens(inputNoCache, cacheReadTokens, pricing.cache?.read);
    const $cacheWrite = getLlmPriceForTokens(inputNoCache, cacheWriteTokens, pricing.cache?.write);
    if ($cacheRead === undefined || $cacheWrite === undefined)
      return { $code: 'partial-price' };

    // compute the advantage from caching
    const $inNoCache = getLlmPriceForTokens(inputNoCache, inputNoCache, pricing.input)!;
    return {
      $c: Math.round(($in + $out + $cacheRead + $cacheWrite) * USD_TO_CENTS * 10000) / 10000,
      $cdCache: Math.round(($inNoCache - $in - $cacheRead - $cacheWrite) * USD_TO_CENTS * 10000) / 10000,
      ...isPartialMessage ? { $code: 'partial-msg' } : {},
    };

  }

  // price without cache
  return {
    $c: Math.round(($in + $out) * USD_TO_CENTS * 10000) / 10000,
    ...isPartialMessage ? { $code: 'partial-msg' } : {},
  };
}


// ChatGenerate extraction for DMessage's smaller metrics

export function chatGenerateMetricsLgToMd(metrics: DChatGenerateMetricsLg): DChatGenerateMetricsMd {
  const keys: (keyof DChatGenerateMetricsMd)[] = ['$c', '$cdCache', '$code', 'TIn', 'TCacheRead', 'TCacheWrite', 'TOut', 'TOutR', 'TsR'] as const;
  const extracted: DChatGenerateMetricsMd = {};

  for (const key of keys) {

    // [OpenAI] we also ignore a TOutR of 0, as networks wirhout reasoning return it. keeping it would be misleading as 'didn't reason but I could have', while it's 'can't reason'
    if (key === 'TOutR' && metrics.TOutR === 0)
      continue;

    if (metrics[key] !== undefined) {
      extracted[key] = metrics[key] as any;
    }
  }

  return extracted;
}