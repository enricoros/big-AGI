import type { DLLM, DPriceChatGenerate, DPricePerMToken, DTieredPrice } from './dllm.types';


export function isModelPriceFree(priceChatGenerate: DPriceChatGenerate): boolean {
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
    const V3: DPriceChatGenerate = {};
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