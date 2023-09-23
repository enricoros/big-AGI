import { ModelVendorAnthropic } from './anthropic/anthropic.vendor';
import { ModelVendorAzure } from './azure/azure.vendor';
import { ModelVendorLocalAI } from './localai/localai.vendor';
import { ModelVendorOoobabooga } from './oobabooga/oobabooga.vendor';
import { ModelVendorOpenAI } from './openai/openai.vendor';
import { ModelVendorOpenRouter } from './openrouter/openrouter.vendor';

import { DLLMId, DModelSource, DModelSourceId, findLLMOrThrow } from '../store-llms';
import { IModelVendor, ModelVendorId } from './IModelVendor';

/** Vendor Instances Registry **/
const MODEL_VENDOR_REGISTRY: Record<ModelVendorId, IModelVendor> = {
  anthropic: ModelVendorAnthropic,
  azure: ModelVendorAzure,
  localai: ModelVendorLocalAI,
  oobabooga: ModelVendorOoobabooga,
  openai: ModelVendorOpenAI,
  openrouter: ModelVendorOpenRouter,
};

const MODEL_VENDOR_DEFAULT: ModelVendorId = 'openai';


export function findAllVendors(): IModelVendor[] {
  const modelVendors = Object.values(MODEL_VENDOR_REGISTRY);
  modelVendors.sort((a, b) => a.rank - b.rank);
  return modelVendors;
}

export function findVendorById(vendorId?: ModelVendorId): IModelVendor | null {
  return vendorId ? (MODEL_VENDOR_REGISTRY[vendorId] ?? null) : null;
}

export function findVendorForLlmOrThrow(llmId: DLLMId) {
  const llm = findLLMOrThrow(llmId);
  const vendor = findVendorById(llm?._source.vId);
  if (!vendor) throw new Error(`callChat: Vendor not found for LLM ${llmId}`);
  return { llm, vendor };
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
    setup: vendor.initializeSetup?.() || {},
  };
}

export function createModelSourceForDefaultVendor(otherSources: DModelSource[]): DModelSource {
  return createModelSourceForVendor(MODEL_VENDOR_DEFAULT, otherSources);
}