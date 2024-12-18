import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { DLLM } from '~/common/stores/llms/llms.types';
import type { DModelsServiceId } from '~/common/stores/llms/modelsservice.types';

import type { MetricsChatGenerateCost_Md } from './metrics.chatgenerate';
import { createServiceMetricsSlice, fallbackEmptyServiceMetricsAggregate, ServiceMetricsSlice } from './metrics.modelservice';


// Store: single per-app, using the slices pattern for aggregations

const useMetricsStore = create<ServiceMetricsSlice>()(persist((...a) => ({
  ...createServiceMetricsSlice(...a),
}), {
  name: 'app-metrics',
}));


export function metricsStoreAddChatGenerate(costs: MetricsChatGenerateCost_Md, inputTokens: number, outputTokens: number, llm: DLLM, debugCostSource: string) {
  useMetricsStore.getState().addChatGenerateCostEntry(costs, inputTokens, outputTokens, llm.sId || null, debugCostSource);
}

export function useCostMetricsForLLMService(serviceId?: DModelsServiceId) {
  return useMetricsStore((state) =>
    serviceId ? state.getAggregateMetricsForService(serviceId) ?? fallbackEmptyServiceMetricsAggregate
      : fallbackEmptyServiceMetricsAggregate,
  );
}
