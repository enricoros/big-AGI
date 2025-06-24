import { useModelsStore } from '../store-llms';


export function useModelsZeroState(): boolean {
  return useModelsStore(state => !state.sources?.length);
}
