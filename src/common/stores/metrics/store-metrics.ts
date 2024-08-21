// //
// // WARNING: Everything here is data at rest. Know what you're doing.
// //

// import { create } from 'zustand';
// import { persist } from 'zustand/middleware';
//
//
// /// Metrics Store - a store to save mostly usages and costs
//
// interface MetricsState {
// }
//
// interface MetricsActions {
// }
//
// export const useMetricsStore = create<MetricsState & MetricsActions>()(persist(
//   (set) => ({
//
//     // initial state
//
//     // actions
//
//   }),
//   {
//     name: 'app-metrics',
//   },
// ));


/**
 * @see DModelPricing
 * @see DChatGeneratePricing
 * @see ModelDescription_schema.ChatGeneratePricing_schema
 */
// type DPricingDeclaration = DModelPricing;
//
// export type DChatGenerateCost = {
//   // $ = USD
//   $?: number,
//   $In?: number,
//   $CacheRead?: number,
//   $CacheWrite?: number,
//   $Out?: number,
// };


//
// export const costService = {
//   addCostEntry: async (entry: Omit<CostEntry, 'id' | 'createdAt'>) => {
//     useCostStore.getState().addCostEntry(entry)
//   },
//
//   getCostEntriesForConversation: async (conversationId: string) => {
//     return useCostStore.getState().getCostEntriesForConversation(conversationId)
//   },
//
//   getTotalCostForConversation: async (conversationId: string) => {
//     return useCostStore.getState().getTotalCostForConversation(conversationId)
//   }
// }



import { DChatGeneratePricing, getPriceForTokens, isModelPriceFree } from '~/common/stores/llms/llms.pricing';

import type { DChatGenerateMetrics } from '../chat/chat.metrics';


export let hack_lastMessageCosts: string = '';


export function metricsStoreAddChatGenerate(metrics?: DChatGenerateMetrics, pricing?: DChatGeneratePricing) {

  const inputTokens = metrics?.TIn || 0;
  const outputTokens = metrics?.TOut || 0;
  const cacheReadTokens = metrics?.TCacheRead || 0;
  const cacheWriteTokens = metrics?.TCacheWrite || 0;

  // Calculate costs
  const costs = calculateCosts(inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens, pricing);
  console.log('Costs:', { costs, metrics, pricing });
}


export interface DAIResourceCosts {
  input: number;
  output: number;
  total: number;
  isPartial: boolean;
  isFree: boolean;
  currency: string;
}


export function formatTokenCost(cost: number) {
  return cost < 1
    ? (cost * 100).toFixed(cost < 0.010 ? 2 : 2) + ' ¢'
    : '$ ' + cost.toFixed(2);
}


function calculateCosts(inputTokens: number, outputTokens: number, cacheReadTokens: number, cacheWriteTokens: number, pricing?: DChatGeneratePricing): DAIResourceCosts {
  if (!pricing || isModelPriceFree(pricing)) {
    return {
      input: 0,
      output: 0,
      total: 0,
      currency: 'USD',
      isPartial: false,
      isFree: true,
    };
  }

  const inputCost = getPriceForTokens(inputTokens, inputTokens, pricing.input) ?? 0;
  const outputCost = getPriceForTokens(inputTokens, outputTokens, pricing.output) ?? 0;
  const cacheReadCost = !cacheReadTokens ? 0 : !pricing.cache ? undefined : getPriceForTokens(cacheReadTokens, cacheReadTokens, pricing.cache.read);
  const cacheWriteCost = !cacheWriteTokens ? 0 : !pricing.cache ? undefined : getPriceForTokens(cacheWriteTokens, cacheWriteTokens, pricing.cache.write);

  const total = inputCost + outputCost + (cacheReadCost || 0) + (cacheWriteCost || 0);
  const isPartial = (typeof cacheReadCost !== 'number') || (typeof cacheWriteCost !== 'number');

  hack_lastMessageCosts = `In: $${formatTokenCost(inputCost)} - CR: $${formatTokenCost(cacheReadCost || 0)} - CW: $${formatTokenCost(cacheWriteCost || 0)} - Out: $${formatTokenCost(outputCost)} = Total: $${formatTokenCost(total)}`;

  return {
    input: inputCost,
    output: outputCost,
    total: total,
    currency: 'USD',
    isPartial,
    isFree: !!pricing._isFree,
  };
}