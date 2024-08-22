import type { DLLM } from './llms.types';


/**
 * Stored in the LLMS DB - IMPORTANT: do not break.
 * Pricing is denominated in $/MegaTokens.
 */
export type DModelPricing = {
  chat?: DChatGeneratePricing,
}

export type DChatGeneratePricing = {
  // unit: 'USD_Mtok',
  input?: DTieredPrice;
  output?: DTieredPrice;
  cache?: {
    cType: 'ant-bp';
    read: DTieredPrice;
    write: DTieredPrice;
    duration: number; // seconds
  };
  // NOT in AixWire_API_ListModels.PriceChatGenerate_schema
  _isFree?: boolean; // precomputed, so we avoid recalculating it
}

type DTieredPrice = DPricePerMToken | DPriceUpTo[];

type DPriceUpTo = {
  upTo: number | null,
  price: DPricePerMToken
};

type DPricePerMToken = number | 'free';


/// detect Free Pricing

export function isModelPriceFree(priceChatGenerate: DChatGeneratePricing): boolean {
  if (!priceChatGenerate) return true;
  return _isPriceFree(priceChatGenerate.input) && _isPriceFree(priceChatGenerate.output);
}

function _isPriceFree(price: DTieredPrice | undefined): boolean {
  if (price === 'free') return true;
  if (price === undefined) return false;
  if (typeof price === 'number') return price === 0;
  return price.every(tier => _isPricePerMTokenFree(tier.price));
}

function _isPricePerMTokenFree(price: DPricePerMToken): boolean {
  return price === 'free' || price === 0;
}


/// Human readable price formatting

export function getLlmPriceForTokens(inputTokens: number, tokens: number, pricing: DTieredPrice | undefined): number | undefined {
  if (!pricing) return undefined;
  if (pricing === 'free') return 0;
  if (typeof pricing === 'number') return tokens * pricing / 1e6;

  // Find the applicable tier based on input tokens
  const applicableTier = pricing.find(tier => tier.upTo === null || inputTokens <= tier.upTo);

  // This should not happen if the pricing is well-formed
  if (!applicableTier) {
    console.log('[DEV] getPriceForTokens: No applicable tier found for input tokens', { inputTokens, pricing });
    return undefined;
  }

  // Apply the price of the found tier to all tokens
  if (applicableTier.price === 'free') return 0;
  return tokens * applicableTier.price / 1e6;
}


// Compatibiltiy layer for pricing V2 -> V3

interface Was_DModelPricingV2 {
  chatIn?: number
  chatOut?: number,
}

export function portModelPricingV2toV3(llm: DLLM): void {
  if (!llm.pricing) return;
  if (typeof llm.pricing !== 'object') return;

  const pretendIsV2 = llm.pricing as Was_DModelPricingV2;
  if (pretendIsV2.chatIn || pretendIsV2.chatOut) {
    const V3: DChatGeneratePricing = {};
    if (pretendIsV2.chatIn)
      V3.input = pretendIsV2.chatIn;
    if (pretendIsV2.chatOut)
      V3.output = pretendIsV2.chatOut;
    V3._isFree = isModelPriceFree(V3);
    llm.pricing = { chat: V3 };
    delete pretendIsV2.chatIn;
    delete pretendIsV2.chatOut;
  }
}