import { useModelsStore } from '~/common/stores/llms/store-llms';

/**
 * Single hooks to access per-domain LLM configurations.
 */
export function useModelDomains() {
  return useModelsStore(state => state.modelAssignments);
}
