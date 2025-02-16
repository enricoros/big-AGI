import type { DLLM } from '../llms.types';
import { useModelsStore } from '../store-llms';


export function useAllLLMs(): ReadonlyArray<DLLM> {
  return useModelsStore(state => state.llms);
}
