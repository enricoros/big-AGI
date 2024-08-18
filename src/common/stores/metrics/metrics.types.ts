import { DModelPricing } from '~/common/stores/llms/llms.pricing';

/**
 * This is a stored type - IMPORTANT: do not break.
 * In particular this is used 'as' AixWire_Particles.ChatGenerateMetrics
 */
export type DChatGenerateMetrics = {
  // T = Tokens
  T?: number,
  TIn?: number,
  TCacheRead?: number,
  TCacheWrite?: number,
  TOut?: number,

  // v = Tokens/s
  vTOutInner?: number,  // TOut / dtInner
  vTOutAll?: number,    // TOut / dtAll

  // dt = milliseconds
  dtStart?: number,
  dtInner?: number,
  dtAll?: number,
};


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
