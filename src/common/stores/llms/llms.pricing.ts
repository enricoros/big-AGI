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

export function isModelPricingFree(pricingChatGenerate: DPricingChatGenerate): boolean {
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


// Compatibility layer for pricing V2 -> V3

interface Was_DModelPricingV2 {
  chatIn?: number
  chatOut?: number,
}

export function portModelPricingV2toV3(llm: DLLM): void {
  if (!llm.pricing) return;
  if (typeof llm.pricing !== 'object') return;

  const pretendIsV2 = llm.pricing as Was_DModelPricingV2;
  if (pretendIsV2.chatIn || pretendIsV2.chatOut) {
    const V3pcg: DPricingChatGenerate = {};
    if (pretendIsV2.chatIn)
      V3pcg.input = pretendIsV2.chatIn;
    if (pretendIsV2.chatOut)
      V3pcg.output = pretendIsV2.chatOut;
    V3pcg._isFree = isModelPricingFree(V3pcg);
    llm.pricing = { chat: V3pcg };
    delete pretendIsV2.chatIn;
    delete pretendIsV2.chatOut;
  }
}