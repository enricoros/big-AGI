import { DModelParameterRegistry, type DModelParameterSpecAny, type DModelParameterValues } from './llms.parameters';
import type { DLLM } from './llms.types';


/**
 * Stored in the LLMS DB - IMPORTANT: do not break.
 * Pricing is denominated in $/MegaTokens.
 */
export type DModelPricing = {
  chat?: DPricingChatGenerate,
}

// NOTE: (!) keep this in sync with PricingChatGenerate_schema (modules/llms/server/llm.server.types.ts)
export type DPricingChatGenerate = {
  // unit: 'USD_Mtok',
  input?: DTieredPricing;
  output?: DTieredPricing;
  cache?: {
    cType: 'ant-bp';
    read: DTieredPricing;
    write: DTieredPricing;
    duration: number; // seconds
  } | {
    cType: 'oai-ac';
    read: DTieredPricing;
    // write: DTieredPricing; // Not needed, as it's automatic
  };
  // NOT in AixWire_API_ListModels.PricingChatGenerate_schema
  _isFree?: boolean; // precomputed, so we avoid recalculating it
}

type DTieredPricing = DPricePerMToken | DPriceUpTo[];

type DPriceUpTo = {
  upTo: number | null,
  price: DPricePerMToken
};

type DPricePerMToken = number | 'free';


/// detect Free Pricing

export function isLLMChatFree_cached(llm: DLLM | null): boolean {
  // simplified: just checking zeros on base pricing (multipliers don't affect free status)
  const pricing = llm?.userPricing ?? llm?.pricing;

  // data issue: assume not free
  if (!pricing?.chat) return false;

  // cached value, including re-caching it
  return pricing.chat._isFree ??= isLLMChatPricingFree(pricing.chat);
}

export function isLLMChatPricingFree(pricingChatGenerate: DPricingChatGenerate): boolean {
  if (!pricingChatGenerate) return true;
  return _isPricingFree(pricingChatGenerate.input) && _isPricingFree(pricingChatGenerate.output);
}

function _isPricingFree(pricing: DTieredPricing | undefined): boolean {
  if (pricing === 'free') return true;
  if (pricing === undefined) return false;
  if (typeof pricing === 'number') return pricing === 0;
  return pricing.every(tier => tier.price === 'free' || tier.price === 0);
}


/// Human readable cost

export function getLlmCostForTokens(tierTokens: number, tokens: number, pricing: DTieredPricing | undefined): number | undefined {
  if (!pricing) return undefined;
  if (pricing === 'free') return 0;

  // Cost = tokens * price / 1e6
  if (typeof pricing === 'number') return tokens * pricing / 1e6;

  // Find the applicable tier based on input tokens
  const applicableTier = pricing.find(tier => tier.upTo === null || tierTokens <= tier.upTo);
  if (!applicableTier) {
    console.log('[DEV] getLlmCostForTokens: No applicable tier found for input tokens', { tierTokens, pricing });
    return undefined;
  }

  // Cost = tier pricing * tokens / 1e6 (or free)
  if (applicableTier.price === 'free') return 0;
  // Note: apply the pricing of the found tier to all tokens
  return tokens * applicableTier.price / 1e6;
}


/// Adjusted Chat Pricing - applies registry-defined price multipliers for active enum parameters

/**
 * Returns the effective chat pricing for a model, adjusted for active parameter-based
 * price multipliers (e.g. fast mode = 6x). Self-contained: reads the DLLM, resolves
 * parameter values, looks up enumPriceMultiplier in the registry, and applies.
 *
 * Note: does NOT affect isLLMChatFree_cached (free * N = free).
 */
export function llmChatPricing_adjusted(llm: DLLM | null): DPricingChatGenerate | undefined {
  if (!llm) return undefined;

  // base chat pricing
  const gcPricing = (llm.userPricing ?? llm.pricing)?.chat;
  if (!gcPricing) return undefined;

  // compute composed multiplier from active enum parameters
  const multiplier = _computePriceMultiplier(llm.parameterSpecs, llm.initialParameters, llm.userParameters);
  if (multiplier === 1) return gcPricing;

  // Apply multiplier to all pricing tiers
  return {
    ...gcPricing,
    ...(gcPricing.input !== undefined ? { input: _multiplyTieredPricing(gcPricing.input, multiplier) } : {}),
    ...(gcPricing.output !== undefined ? { output: _multiplyTieredPricing(gcPricing.output, multiplier) } : {}),
    ...(!gcPricing.cache ? {} : {
      cache: gcPricing.cache.cType === 'ant-bp' ? {
        cType: 'ant-bp',
        read: _multiplyTieredPricing(gcPricing.cache.read, multiplier),
        write: _multiplyTieredPricing(gcPricing.cache.write, multiplier),
        duration: gcPricing.cache.duration,
      } : gcPricing.cache.cType === 'oai-ac' ? {
        cType: 'oai-ac',
        read: _multiplyTieredPricing(gcPricing.cache.read, multiplier),
      } : undefined,
    }),
  };
}

/**
 * Scans parameterSpecs for enum parameters with enumPriceMultiplier in the registry.
 * For each, resolves the effective value (user > initial) and if it matches a multiplier key, accumulates it.
 *
 * Note: does NOT consult `requiredFallback` - any enum with enumPriceMultiplier must have its
 * effective default in initialParameters (via spec or registry `initialValue`).
 */
function _computePriceMultiplier(parameterSpecs: DModelParameterSpecAny[], initialParameters: DModelParameterValues | undefined, userParameters: DModelParameterValues | undefined): number {
  if (!parameterSpecs?.length) return 1;

  let multiplier = 1;
  for (const spec of parameterSpecs) {

    const paramId = spec.paramId;
    const registryDef = DModelParameterRegistry[paramId];

    // 'enum' values multipliers
    if (registryDef?.type === 'enum' && 'enumPriceMultiplier' in registryDef && registryDef.enumPriceMultiplier) {
      const value = (userParameters?.[paramId] ?? initialParameters?.[paramId]) as string | undefined;
      if (value !== undefined) {
        const m = (registryDef.enumPriceMultiplier as Record<string, number | undefined>)[value];
        if (m !== undefined && m !== 1 && m !== null /* extra caution */)
          multiplier *= m;
      }
    }
    // NOTE: may add other (e.g. boolean) multipliers in the future
  }

  return multiplier;
}

function _multiplyTieredPricing(pricing: DTieredPricing, multiplier: number): DTieredPricing {
  if (pricing === 'free') return 'free';
  if (typeof pricing === 'number') return pricing * multiplier;
  // if not 'free' or number, must be DPriceUpTo[]
  return pricing.map(tier => ({
    ...tier,
    price: tier.price === 'free' ? 'free' as const : tier.price * multiplier,
  }));
}


// Compatibility layer for pricing V2 -> V3

interface Was_DModelPricingV2 {
  chatIn?: number
  chatOut?: number,
}

export function portModelPricingV2toV3(llm: DLLM): void {
  // NOTE: direct .pricing access instead of llmChatPricing_adjusted, because there was no user pricing in this generation
  if (!llm.pricing) return;
  if (typeof llm.pricing !== 'object') return;

  const pretendIsV2 = llm.pricing as Was_DModelPricingV2;
  if (pretendIsV2.chatIn || pretendIsV2.chatOut) {
    const V3pcg: DPricingChatGenerate = {};
    if (pretendIsV2.chatIn)
      V3pcg.input = pretendIsV2.chatIn;
    if (pretendIsV2.chatOut)
      V3pcg.output = pretendIsV2.chatOut;
    V3pcg._isFree = isLLMChatPricingFree(V3pcg);
    llm.pricing = { chat: V3pcg };
    delete pretendIsV2.chatIn;
    delete pretendIsV2.chatOut;
  }
}