import { ModelVendorAnthropic } from './anthropic/anthropic.vendor';
import { ModelVendorAzure } from './azure/azure.vendor';
import { ModelVendorGemini } from './googleai/gemini.vendor';
import { ModelVendorLocalAI } from './localai/localai.vendor';
import { ModelVendorMistral } from './mistral/mistral.vendor';
import { ModelVendorOllama } from './ollama/ollama.vendor';
import { ModelVendorOoobabooga } from './oobabooga/oobabooga.vendor';
import { ModelVendorOpenAI } from './openai/openai.vendor';
import { ModelVendorOpenRouter } from './openrouter/openrouter.vendor';

import type { IModelVendor } from './IModelVendor';
import { DLLMId, DModelSource, DModelSourceId, findLLMOrThrow } from '../store-llms';

export type ModelVendorId =
  | 'anthropic'
  | 'azure'
  | 'googleai'
  | 'localai'
  | 'mistral'
  | 'ollama'
  | 'oobabooga'
  | 'openai'
  | 'openrouter';

/** Global: Vendor Instances Registry **/
const MODEL_VENDOR_REGISTRY: Record<ModelVendorId, IModelVendor> = {
  anthropic: ModelVendorAnthropic,
  azure: ModelVendorAzure,
  googleai: ModelVendorGemini,
  localai: ModelVendorLocalAI,
  mistral: ModelVendorMistral,
  ollama: ModelVendorOllama,
  oobabooga: ModelVendorOoobabooga,
  openai: ModelVendorOpenAI,
  openrouter: ModelVendorOpenRouter,
} as Record<string, IModelVendor>;

const MODEL_VENDOR_DEFAULT: ModelVendorId = 'openai';


export function findAllVendors(): IModelVendor[] {
  const modelVendors = Object.values(MODEL_VENDOR_REGISTRY);
  modelVendors.sort((a, b) => a.rank - b.rank);
  return modelVendors;
}

export function findVendorById<TSourceSetup = unknown, TAccess = unknown, TLLMOptions = unknown>(
  vendorId?: ModelVendorId,
): IModelVendor<TSourceSetup, TAccess, TLLMOptions> | null {
  return vendorId ? (MODEL_VENDOR_REGISTRY[vendorId] as IModelVendor<TSourceSetup, TAccess, TLLMOptions>) ?? null : null;
}

export function findVendorForLlmOrThrow<TSourceSetup = unknown, TAccess = unknown, TLLMOptions = unknown>(llmId: DLLMId) {
  const llm = findLLMOrThrow<TSourceSetup, TLLMOptions>(llmId);
  const vendor = findVendorById<TSourceSetup, TAccess, TLLMOptions>(llm?._source.vId);
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