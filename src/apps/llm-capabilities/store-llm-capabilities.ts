import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { ProbeResult } from './probes/probe.types';


/**
 * Results are keyed by `${llmId}::${scenarioId}` so the latest probe run for each pair
 * is always available across sessions. Running a new probe for the same pair overwrites.
 */
type ResultsMap = Record<string, ProbeResult>;

export function resultKey(llmId: string, scenarioId: string): string {
  return `${llmId}::${scenarioId}`;
}

interface LlmCapabilitiesState {
  results: ResultsMap;
  putResult: (r: ProbeResult) => void;
  clearAll: () => void;
}

export const useLlmCapabilitiesStore = create<LlmCapabilitiesState>()(// persist(
  (set) => ({
    results: {},
    putResult: (r) =>
      set(state => ({ results: { ...state.results, [resultKey(r.llmId, r.scenarioId)]: r } })),
    clearAll: () => set({ results: {} }),
  }),
  // {
  //   name: 'app-llm-capabilities',
  //   version: 1,
  // },
);
