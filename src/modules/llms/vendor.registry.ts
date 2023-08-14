import { DModelSource, DModelSourceId, ModelVendor, ModelVendorId } from './llm.types';
import { ModelVendorAnthropic } from './anthropic/anthropic.vendor';
import { ModelVendorLocalAI } from './localai/localai.vendor';
import { ModelVendorOoobabooga } from './oobabooga/oobabooga.vendor';
import { ModelVendorOpenAI } from './openai/openai.vendor';
import { ModelVendorOpenRouter } from './openrouter/openrouter.vendor';


/// Internal - Main Vendor Registry ///

const MODEL_VENDOR_REGISTRY: Record<ModelVendorId, ModelVendor> = {
  anthropic: ModelVendorAnthropic,
  localai: ModelVendorLocalAI,
  oobabooga: ModelVendorOoobabooga,
  openai: ModelVendorOpenAI,
  openrouter: ModelVendorOpenRouter,
  // azure_openai: { id: 'azure_openai', name: 'Azure OpenAI', instanceLimit: 1, location: 'cloud', rank: 30 },
  // google_vertex: { id: 'google_vertex', name: 'Google Vertex', instanceLimit: 1, location: 'cloud', rank: 40 },
  // anthropic: { id: 'anthropic', name: 'Anthropic', instanceLimit: 1, location: 'cloud', rank: 50 },
};

const DEFAULT_MODEL_VENDOR: ModelVendorId = 'openai';

export function findAllVendors(): ModelVendor[] {
  const modelVendors = Object.values(MODEL_VENDOR_REGISTRY);
  modelVendors.sort((a, b) => a.rank - b.rank);
  return modelVendors;
}

export function findVendorById(vendorId?: ModelVendorId): ModelVendor | null {
  return vendorId ? (MODEL_VENDOR_REGISTRY[vendorId] ?? null) : null;
}

export function createModelSourceForDefaultVendor(otherSources: DModelSource[]): DModelSource {
  return createModelSourceForVendor(DEFAULT_MODEL_VENDOR, otherSources);
}

export function createModelSourceForVendor(vendorId: ModelVendorId, otherSources: DModelSource[]): DModelSource {
  // get vendor
  const vendor = findVendorById(vendorId);
  if (!vendor) throw new Error(`createModelSourceForVendor: Vendor not found for id ${vendorId}`);

  // make a unique sourceId
  let sourceId: DModelSourceId = vendorId;
  let sourceN = 0;
  while (otherSources.find(source => source.id === sourceId)) {
    sourceN++;
    sourceId = `${vendorId}-${sourceN}`;
  }

  // create the source
  return {
    id: sourceId,
    label: vendor.name + (sourceN > 0 ? ` #${sourceN}` : ''),
    vId: vendorId,
    setup: vendor.initalizeSetup?.() || {},
  };
}