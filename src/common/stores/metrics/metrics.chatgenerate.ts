import { DPricingChatGenerate, getLlmCostForTokens, isLLMChatPricingFree } from '~/common/stores/llms/llms.pricing';
import { usdToCents } from '~/common/util/costUtils';


// configuration
const METRICS_APPROXIMATE_DT_INNER_THRESHOLD = 200; // ms
const METRICS_APPROXIMATE_VT_TOKENS_THRESHOLD = 40; // tokens


/**
 * This is a stored type - IMPORTANT: do not break.
 * - stored by DMessage > DMessageGenerator
 */
export type DMetricsChatGenerate_Md =
  Omit<MetricsChatGenerateTokens, 'T'> &
  MetricsChatGenerateCost_Md &
  Pick<MetricsChatGenerateTime, 'dtAll' | 'dtStart' | 'vTOutInner'>; // 2025-02-27: added the inner velocity, which wasn't stored before

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

  // n = Counts (per-call billed server tools)
  nWebSearch?: number,  // web searches executed - OpenAI tool_usage, Anthropic server_tool_use, xAI server-side tools, Gemini grounding queries

  // If set, indicates unreliability or Stop Reason (sR)
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
  $cReported?: number,  // Total cost in cents as reported by provider (e.g. Perplexity usage.cost.total_cost)
  $cdCache?: number,    // Cache advantage: input side as if uncached, minus actual (negative = the write surcharge outweighed the reads this turn)
  // $c by class (absent on older messages and on '$code' outcomes)
  $cIn?: number,        // uncached input
  $cCacheR?: number,    // cache reads (only when read tokens > 0)
  $cCacheW?: number,    // cache writes (only when write tokens > 0)
  $cOut?: number,       // output, reasoning included
  $cTools?: number,     // per-call tool fees (only when calls > 0)
  $xPrice?: number,     // provider-confirmed price multiplier vs listed rates (echoed service tier: flex 0.5, fast 2, ...); parsed, and used over the parameter-side multiplier
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

  // calculate the Token velocities
  if (metrics.TOut !== undefined && metrics.dtAll !== undefined && metrics.dtAll > 0) {

    // inner time approximation (dtStart -> dtAll)
    if (!metrics.dtInner && metrics.dtStart !== undefined && metrics.dtStart > 0) {
      /**
       * Only use the approximate inner duration if it's greater than a threshold. this is to prevent
       * This is to prevent first -> last event timing (a poor substitute for the actual inner duration)
       * to be too short to be meaningful.
       */
      const dtInnerApprox = metrics.dtAll - metrics.dtStart;
      if (dtInnerApprox >= METRICS_APPROXIMATE_DT_INNER_THRESHOLD)
        metrics.dtInner = dtInnerApprox;
    }

    // inner velocity approximation (if not reported by the API, approximate to first -> last event)
    if (!metrics.vTOutInner && metrics.dtInner !== undefined && metrics.dtInner > 0) {

      // for OpenAI reasoning models, we needto remove the reasoning tokens from the total, as they were not counted
      const TOutReceived = metrics.TOut - (metrics.TOutR || 0);

      if (TOutReceived >= METRICS_APPROXIMATE_VT_TOKENS_THRESHOLD)
        metrics.vTOutInner = Math.round(100 * TOutReceived / (metrics.dtInner / 1000)) / 100;
    }

    // outer velocity (end-to-end)
    metrics.vTOutAll = Math.round(100 * metrics.TOut / (metrics.dtAll / 1000)) / 100;

  }
}


// ChatGenerate extraction for DMessage's smaller metrics

const _MD_OPTIONAL_KEYS: readonly (keyof DMetricsChatGenerate_Md)[] = [
  '$c', '$cReported', '$cdCache', '$cIn', '$cCacheR', '$cCacheW', '$cOut', '$cTools', '$xPrice', '$code', // select costs
  'TIn', 'TCacheRead', 'TCacheWrite', 'TOut', 'TOutR', 'nWebSearch', // select token and call counts
  'dtAll', 'dtStart', 'vTOutInner', // select token timings/velocities
  'TsR', // stop reason
];

export function metricsChatGenerateLgToMd(metrics: DMetricsChatGenerate_Lg): DMetricsChatGenerate_Md {
  const extracted: DMetricsChatGenerate_Md = {};

  for (const key of _MD_OPTIONAL_KEYS) {

    // [OpenAI] we also ignore a TOutR of 0, as networks without reasoning return it. keeping it would be misleading as 'didn't reason but I could have', while it's 'can't reason'
    if (key === 'TOutR' && metrics.TOutR === 0)
      continue;

    // [OpenAI] we also ignore a TOutA of 0 (no audio in this output)
    // if (key === 'TOutA' && metrics.TOutA === 0)
    //   continue;

    // 1x is the norm: not stored (the finalizer reads the Lg value)
    if (key === '$xPrice' && metrics.$xPrice === 1)
      continue;

    if (metrics[key] !== undefined) {
      extracted[key] = metrics[key] as any;
    }
  }

  return extracted;
}


// ChatGenerate cost metrics

export function metricsComputeChatGenerateCostsMd(metrics?: Readonly<DMetricsChatGenerate_Md>, pricing?: DPricingChatGenerate | undefined, logLlmRefId?: string): MetricsChatGenerateCost_Md | undefined {
  if (!metrics)
    return undefined;

  // estimate from the price table, then carry the provider-reported (billed) cost alongside - it survives
  // even when the estimate can't be computed ('no-pricing', 'partial-price', ...)
  const costs = _computeCostsFromPricing(metrics, pricing, logLlmRefId);
  if (metrics.$cReported !== undefined)
    costs.$cReported = metrics.$cReported;
  return costs;
}

function _computeCostsFromPricing(metrics: Readonly<DMetricsChatGenerate_Md>, pricing: DPricingChatGenerate | undefined, logLlmRefId?: string): MetricsChatGenerateCost_Md {

  // metrics: token presence
  const inNewTokens = metrics.TIn || 0;
  const inCacheReadTokens = metrics.TCacheRead || 0;
  const inCacheWriteTokens = metrics.TCacheWrite || 0;
  const sumInputTokens = inNewTokens + inCacheReadTokens + inCacheWriteTokens;
  const outTokens = metrics.TOut || 0;
  const webSearchCalls = metrics.nWebSearch || 0;

  // usage: presence
  if (!sumInputTokens && !outTokens && !webSearchCalls)
    return { $code: 'no-tokens' };

  // pricing: presence
  if (!pricing)
    return { $code: 'no-pricing' };

  // pricing: bail if free
  if (isLLMChatPricingFree(pricing))
    return { $code: 'free' };


  // mark the costs as partial if the message was not completely received - i.e. the server did not tell us the final tokens count
  const isPartialMessage = metrics.TsR === 'pending' || metrics.TsR === 'aborted';

  // the tier is chosen on total input and applies to every class, output included (OpenAI >272K, Anthropic and Gemini >200K)
  const tierTokens = sumInputTokens;
  const $in = getLlmCostForTokens(tierTokens, inNewTokens, pricing.input);
  const $out = getLlmCostForTokens(tierTokens, outTokens, pricing.output);
  if ($in === undefined || $out === undefined) {
    // many llms don't have pricing information, so the cost computation ends here
    return { $code: 'partial-price' };
  }

  // Unknown prices are the norm, not the edge: a class with no price contributes nothing to $c and emits no breakdown key,
  // and the estimate is flagged partial. Never an invented rate.

  // per-call tool fees
  const webSearchFee = pricing.tools?.webSearch;
  const $tools = (webSearchCalls > 0 && webSearchFee !== undefined) ? webSearchCalls * webSearchFee / 1000 : undefined;
  const toolsUnpriced = webSearchCalls > 0 && $tools === undefined;

  // cache classes: inside a priced cache block an absent write price means writes bill as input (a vendor fact, never 0);
  // with no cache block, or a tier gap, the class is unknown
  const cachePricing = pricing.cache;
  const $cacheRead = !inCacheReadTokens ? undefined : getLlmCostForTokens(tierTokens, inCacheReadTokens, cachePricing?.read);
  const $cacheWrite = !inCacheWriteTokens ? undefined : getLlmCostForTokens(tierTokens, inCacheWriteTokens, cachePricing ? (cachePricing.write ?? pricing.input) : undefined);
  const cacheUnpriced = (inCacheReadTokens > 0 && $cacheRead === undefined) || (inCacheWriteTokens > 0 && $cacheWrite === undefined);
  const cachePriced = (inCacheReadTokens > 0 || inCacheWriteTokens > 0) && !cacheUnpriced;
  if (cacheUnpriced || toolsUnpriced)
    console.log(`Unpriced usage for ${logLlmRefId}: cache=${cacheUnpriced}, tools=${toolsUnpriced}`);

  const $cache = ($cacheRead ?? 0) + ($cacheWrite ?? 0);

  // an unpriced class wins over a truncated message
  const $code = (toolsUnpriced || cacheUnpriced) ? 'partial-price' : isPartialMessage ? 'partial-msg' : undefined;

  return {
    $c: usdToCents($in + $cache + $out + ($tools ?? 0)),
    // cache advantage: the input side as if uncached, minus actual - only when every cache class is priced
    ...(cachePriced && { $cdCache: usdToCents(getLlmCostForTokens(tierTokens, sumInputTokens, pricing.input)! - $in - $cache) }),
    $cIn: usdToCents($in),
    ...($cacheRead !== undefined && { $cCacheR: usdToCents($cacheRead) }),
    ...($cacheWrite !== undefined && { $cCacheW: usdToCents($cacheWrite) }),
    $cOut: usdToCents($out),
    ...($tools !== undefined && { $cTools: usdToCents($tools) }),
    ...($code && { $code }),
  };
}
