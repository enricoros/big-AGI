import type React from 'react';

import { DModelSource, DModelSourceId, findUniqueSourceId, useModelsStore } from './store-models';
import { ModelVendorLocalAI } from './localai/vendor';
import { ModelVendorOpenAI } from './openai/vendor';


/**
 * Vendor - a vendor of models, e.g. OpenAI - not stored, client-side only - not dynamic
 */
export type ModelVendorId = 'localai' | 'openai'; // | 'anthropic' | 'azure_openai' | 'google_vertex';

export interface ModelVendor {
  id: ModelVendorId;

  // metadata
  name: string;
  multiple: boolean;
  location: 'local' | 'cloud';
  rank: number;
  enabled?: boolean; // probably remove

  // factories
  createSource: (sourceId: DModelSourceId, sourceCount: number) => DModelSource;
  createSetupComponent: (sourceId: DModelSourceId) => React.JSX.Element;
}

export function rankedVendors(): ModelVendor[] {
  const modelVendors = Object.values(MODEL_VENDOR_REGISTRY);
  modelVendors.sort((a, b) => a.rank - b.rank);
  return modelVendors;
}

export function findVendor(id?: ModelVendorId): ModelVendor | null {
  return id ? (MODEL_VENDOR_REGISTRY[id] ?? null) : null;
}

export function addDefaultSourceIfEmpty() {
  const { addSource, sources } = useModelsStore.getState();
  if (!sources.length) {
    const { id, count } = findUniqueSourceId(ModelVendorOpenAI.id, sources);
    const source = ModelVendorOpenAI.createSource(id, count);
    addSource(source);
  }
}


/// Internals ///

const MODEL_VENDOR_REGISTRY: Record<ModelVendorId, ModelVendor> = {
  openai: ModelVendorOpenAI,
  localai: ModelVendorLocalAI,
  /*anthropic: {
    id: 'anthropic',
    name: 'Anthropic',
    multiple: false,
    location: 'cloud',
    rank: 50,
  },
  azure_openai: {
    id: 'azure_openai',
    name: 'Azure OpenAI',
    multiple: false,
    location: 'cloud',
    rank: 30,
  },
  google_vertex: {
    id: 'google_vertex',
    name: 'Google Vertex',
    multiple: false,
    location: 'cloud',
    rank: 40,
  }*/
};