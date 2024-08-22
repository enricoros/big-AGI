import type { DLLM } from '~/common/stores/llms/llms.types';

import type { ChatGenerateCostMetricsMd } from './metrics.chatgenerate';

export let hack_lastMessageCosts: string = '';


export function formatTokenCost(cost: number) {
  return cost < 1
    ? (cost * 100).toFixed(cost < 0.010 ? 2 : 2) + ' ¢'
    : '$ ' + cost.toFixed(2);
}

export function metricsStoreAddChatGenerate(costs: ChatGenerateCostMetricsMd, llm: DLLM) {
  hack_lastMessageCosts = JSON.stringify(costs, null, 2);
  console.log('metricsStoreAddChatGenerate', hack_lastMessageCosts);
}


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

