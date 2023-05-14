import { DModelSource, DModelSourceId, ModelVendor, ModelVendorId } from '../llm.types';
import { ModelVendorLocalAI } from '../localai/vendor';
import { ModelVendorOpenAI } from '../openai/vendor';


export function rankedVendors(): ModelVendor[] {
  const modelVendors = Object.values(MODEL_VENDOR_REGISTRY);
  modelVendors.sort((a, b) => a.rank - b.rank);
  return modelVendors;
}

export function findVendorById(id?: ModelVendorId): ModelVendor | null {
  return id ? (MODEL_VENDOR_REGISTRY[id] ?? null) : null;
}

export function createDefaultSource(sources: DModelSource[]): DModelSource {
  const { id, count } = getUniqueSourceId(ModelVendorOpenAI.id, sources);
  return ModelVendorOpenAI.createSource(id, count);
}

export function getUniqueSourceId(vendorId: ModelVendorId, otherSources: DModelSource[]): { id: string, count: number } {
  let id: DModelSourceId = vendorId;
  let count = 0;
  while (otherSources.find(source => source.id === id)) {
    count++;
    id = `${vendorId}-${count}`;
  }
  return { id, count };
}


/// Internals ///

const MODEL_VENDOR_REGISTRY: Record<ModelVendorId, ModelVendor> = {
  openai: ModelVendorOpenAI,
  localai: ModelVendorLocalAI,
  // azure_openai: { id: 'azure_openai', name: 'Azure OpenAI', multiple: false, location: 'cloud', rank: 30 },
  // google_vertex: { id: 'google_vertex', name: 'Google Vertex', multiple: false, location: 'cloud', rank: 40 }
  // anthropic: { id: 'anthropic', name: 'Anthropic', multiple: false, location: 'cloud', rank: 50 },
};