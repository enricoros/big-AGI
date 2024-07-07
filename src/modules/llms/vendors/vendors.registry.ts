import { ModelVendorAnthropic } from './anthropic/anthropic.vendor';
import { ModelVendorAzure } from './azure/azure.vendor';
import { ModelVendorGemini } from './gemini/gemini.vendor';
import { ModelVendorGroq } from './groq/groq.vendor';
import { ModelVendorLMStudio } from './lmstudio/lmstudio.vendor';
import { ModelVendorLocalAI } from './localai/localai.vendor';
import { ModelVendorMistral } from './mistral/mistral.vendor';
import { ModelVendorOllama } from './ollama/ollama.vendor';
import { ModelVendorOoobabooga } from './oobabooga/oobabooga.vendor';
import { ModelVendorOpenAI } from './openai/openai.vendor';
import { ModelVendorOpenRouter } from './openrouter/openrouter.vendor';
import { ModelVendorPerplexity } from './perplexity/perplexity.vendor';
import { ModelVendorTogetherAI } from './togetherai/togetherai.vendor';

import type { IModelVendor } from './IModelVendor';
import { DLLMId, DModelSource, DModelSourceId, findLLMOrThrow, findSourceOrThrow } from '../store-llms';
import { ModelVendorDeepseek } from './deepseek/deepseekai.vendor';

export type ModelVendorId =
  | 'anthropic'
  | 'azure'
  | 'googleai'
  | 'groq'
  | 'lmstudio'
  | 'localai'
  | 'mistral'
  | 'ollama'
  | 'oobabooga'
  | 'openai'
  | 'openrouter'
  | 'perplexity'
  | 'togetherai'
  | 'deepseek';

/** Global: Vendor Instances Registry **/
const MODEL_VENDOR_REGISTRY: Record<ModelVendorId, IModelVendor> = {
  anthropic: ModelVendorAnthropic,
  azure: ModelVendorAzure,
  googleai: ModelVendorGemini,
  groq: ModelVendorGroq,
  lmstudio: ModelVendorLMStudio,
  localai: ModelVendorLocalAI,
  mistral: ModelVendorMistral,
  ollama: ModelVendorOllama,
  oobabooga: ModelVendorOoobabooga,
  openai: ModelVendorOpenAI,
  openrouter: ModelVendorOpenRouter,
  perplexity: ModelVendorPerplexity,
  togetherai: ModelVendorTogetherAI,
  deepseek: ModelVendorDeepseek,
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
  if (!vendor) throw new Error(`Vendor not found for LLM ${llmId}`);
  return { llm, vendor };
}

export function findAccessForSourceOrThrow<TSourceSetup = unknown, TAccess = unknown>(sourceId: DModelSourceId) {
  const source = findSourceOrThrow<TSourceSetup>(sourceId);
  const vendor = findVendorById<TSourceSetup, TAccess>(source.vId);
  if (!vendor) throw new Error(`ModelSource ${sourceId} has no vendor`);
  return { source, vendor, transportAccess: vendor.getTransportAccess(source.setup) };
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
    label: vendor.name, // NOTE: will be (re/) numbered upon adding to the store
    vId: vendorId,
    setup: vendor.initializeSetup?.() || {},
  };
}

export function createModelSourceForDefaultVendor(otherSources: DModelSource[]): DModelSource {
  return createModelSourceForVendor(MODEL_VENDOR_DEFAULT, otherSources);
}