import { shallow } from 'zustand/shallow';

import type { IModelVendor } from './IModelVendor';
import { DModelSource, DModelSourceId, useModelsStore } from '../store-llms';


/**
 * Source-specific read/write - great time saver
 */
export function useSourceSetup<TSourceSetup, TAccess, TLLMOptions>(sourceId: DModelSourceId, vendor: IModelVendor<TSourceSetup, TAccess, TLLMOptions>) {

  // invalidates only when the setup changes
  const { updateSourceSetup, ...rest } = useModelsStore(state => {

    // find the source (or null)
    const source: DModelSource<TSourceSetup> | null = state.sources.find(source => source.id === sourceId) as DModelSource<TSourceSetup> ?? null;

    // (safe) source-derived properties
    const sourceSetupValid = (source?.setup && vendor?.validateSetup) ? vendor.validateSetup(source.setup as TSourceSetup) : false;
    const sourceLLMs = source ? state.llms.filter(llm => llm._source === source) : [];
    const access = vendor.getTransportAccess(source?.setup);

    return {
      source,
      partialSetup: source?.setup ?? null, // NOTE: do not use - prefer ACCESS; only used in 1 edge case now
      access,
      sourceHasLLMs: !!sourceLLMs.length,
      sourceSetupValid,
      updateSourceSetup: state.updateSourceSetup,
    };
  }, shallow);

  // convenience function for this source
  const updateSetup = (partialSetup: Partial<TSourceSetup>) => updateSourceSetup<TSourceSetup>(sourceId, partialSetup);
  return { ...rest, updateSetup };
}