import type { StateCreator } from 'zustand';

import type { DModelsServiceId } from '~/common/stores/llms/modelsservice.types';

import type { MetricsChatGenerateCost_Md } from './metrics.chatgenerate';


interface ServiceMetricsAggregate {
  // accumulators
  totalCosts: number;
  totalSavings: number;
  totalInputTokens: number;
  totalOutputTokens: number;

  // Usage statistics
  usageCount: number;
  firstUsageDate: number; // Date.now()
  lastUsageDate: number; // Date.now()

  // counters
  freeUsages: number;
  noPricingUsages: number;
  noTokenUsages: number;
  partialMessageUsages: number;
  partialPriceUsages: number;
}

function createServiceMetricsAggregate(): ServiceMetricsAggregate {
  return {
    totalCosts: 0,
    totalSavings: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    usageCount: 0,
    firstUsageDate: 0,
    lastUsageDate: 0,
    freeUsages: 0,
    noPricingUsages: 0,
    noTokenUsages: 0,
    partialMessageUsages: 0,
    partialPriceUsages: 0,
  };
}

export const fallbackEmptyServiceMetricsAggregate = createServiceMetricsAggregate();


// Service Metrics Store Slice

interface ServiceMetricsState {

  // Service Metrics
  serviceMetrics: Record<DModelsServiceId, ServiceMetricsAggregate>;

}

interface ServiceMetricsActions {
  addChatGenerateCostEntry: (costs: MetricsChatGenerateCost_Md, inputTokens: number, outputTokens: number, serviceId: DModelsServiceId | null, debugCostSource: string) => void;
  getAggregateMetricsForService: (serviceId: DModelsServiceId) => ServiceMetricsAggregate | undefined;
}

export type ServiceMetricsSlice = ServiceMetricsState & ServiceMetricsActions;

export const createServiceMetricsSlice: StateCreator<ServiceMetricsSlice, [], [], ServiceMetricsSlice> = (set, get) => ({

  serviceMetrics: {},

  addChatGenerateCostEntry: (costs, inputTokens, outputTokens, serviceId: DModelsServiceId | null, debugCostSource: string) => set((state) => {
    if (!serviceId) return state;

    const currentMetrics = state.serviceMetrics[serviceId] || createServiceMetricsAggregate();
    const newMetrics = updateServiceMetrics(currentMetrics, costs, inputTokens, outputTokens, Date.now());

    return {
      serviceMetrics: {
        ...state.serviceMetrics,
        [serviceId]: newMetrics,
      },
    };
  }),

  getAggregateMetricsForService: (serviceId): ServiceMetricsAggregate | undefined => {
    return get().serviceMetrics[serviceId];
  },

});


/// Aggregation Functions

const CENTS_TO_DOLLARS = 0.01;

function updateServiceMetrics(currentMetrics: ServiceMetricsAggregate, costs: MetricsChatGenerateCost_Md, inputTokens: number, outputTokens: number, timestamp: number): ServiceMetricsAggregate {
  const newMetrics = { ...currentMetrics };

  // Update cost accumulators
  if (costs.$c !== undefined)
    newMetrics.totalCosts += costs.$c * CENTS_TO_DOLLARS;
  if (costs.$cdCache !== undefined)
    newMetrics.totalSavings += costs.$cdCache * CENTS_TO_DOLLARS;

  // Update accumulators
  newMetrics.totalInputTokens += inputTokens;
  newMetrics.totalOutputTokens += outputTokens;

  // Update usage statistics
  newMetrics.usageCount++;
  newMetrics.lastUsageDate = timestamp;
  if (!newMetrics.firstUsageDate)
    newMetrics.firstUsageDate = timestamp;

  // Update counters based on cost code
  if (costs.$code) {
    switch (costs.$code) {
      case 'free':
        newMetrics.freeUsages++;
        break;
      case 'no-pricing':
        newMetrics.noPricingUsages++;
        break;
      case 'no-tokens':
        newMetrics.noTokenUsages++;
        break;
      case 'partial-msg':
        newMetrics.partialMessageUsages++;
        break;
      case 'partial-price':
        newMetrics.partialPriceUsages++;
        break;
    }
  }

  return newMetrics;
}