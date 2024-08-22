import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { DLLM } from '~/common/stores/llms/llms.types';
import type { DModelsServiceId } from '~/common/stores/llms/modelsservice.types';

import type { ChatGenerateCostMetricsMd } from './metrics.chatgenerate';
import { createServiceMetricsSlice, initialServiceMetricsAggregate, ServiceMetricsSlice } from './metrics.modelservice';


// Store: single per-app, using the slices pattern for aggregations

const useMetricsStore = create<ServiceMetricsSlice>()(persist((...a) => ({
  ...createServiceMetricsSlice(...a),
}), {
  name: 'app-metrics',
}));


export function metricsStoreAddChatGenerate(costs: ChatGenerateCostMetricsMd, llm: DLLM, inputTokens: number, outputTokens: number) {
  useMetricsStore.getState().addCostEntry(llm, costs, inputTokens, outputTokens);
}

export function useCostMetricsForLLMService(serviceId?: DModelsServiceId) {
  return useMetricsStore((state) =>
    serviceId ? state.getCostMetricsForService(serviceId) : initialServiceMetricsAggregate,
  );
}
