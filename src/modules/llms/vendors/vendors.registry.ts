import { ModelVendorAnthropic } from './anthropic/anthropic.vendor';
import { ModelVendorAzure } from './azure/azure.vendor';
import { ModelVendorDeepseek } from './deepseek/deepseekai.vendor';
import { ModelVendorGemini } from './gemini/gemini.vendor';
import { ModelVendorGroq } from './groq/groq.vendor';
import { ModelVendorLMStudio } from './lmstudio/lmstudio.vendor';
import { ModelVendorLocalAI } from './localai/localai.vendor';
import { ModelVendorMistral } from './mistral/mistral.vendor';
import { ModelVendorOllama } from './ollama/ollama.vendor';
import { ModelVendorOpenAI } from './openai/openai.vendor';
import { ModelVendorOpenPipe } from './openpipe/openpipe.vendor';
import { ModelVendorOpenRouter } from './openrouter/openrouter.vendor';
import { ModelVendorPerplexity } from './perplexity/perplexity.vendor';
import { ModelVendorTogetherAI } from './togetherai/togetherai.vendor';
import { ModelVendorXAI } from './xai/xai.vendor';

import type { IModelVendor } from './IModelVendor';


export type ModelVendorId =
  | 'anthropic'
  | 'azure'
  | 'deepseek'
  | 'googleai'
  | 'groq'
  | 'lmstudio'
  | 'localai'
  | 'mistral'
  | 'ollama'
  | 'openai'
  | 'openpipe'
  | 'openrouter'
  | 'perplexity'
  | 'togetherai'
  | 'xai'
  ;

/** Global: Vendor Instances Registry **/
const MODEL_VENDOR_REGISTRY: Record<ModelVendorId, IModelVendor> = {
  anthropic: ModelVendorAnthropic,
  azure: ModelVendorAzure,
  deepseek: ModelVendorDeepseek,
  googleai: ModelVendorGemini,
  groq: ModelVendorGroq,
  lmstudio: ModelVendorLMStudio,
  localai: ModelVendorLocalAI,
  mistral: ModelVendorMistral,
  ollama: ModelVendorOllama,
  openai: ModelVendorOpenAI,
  openpipe: ModelVendorOpenPipe,
  openrouter: ModelVendorOpenRouter,
  perplexity: ModelVendorPerplexity,
  togetherai: ModelVendorTogetherAI,
  xai: ModelVendorXAI,
} as Record<string, IModelVendor>;


export function findAllModelVendors(): IModelVendor[] {
  const modelVendors = Object.values(MODEL_VENDOR_REGISTRY);
  modelVendors.sort((a, b) => a.displayRank - b.displayRank);
  return modelVendors;
}

export function findModelVendor<TServiceSettings extends object = {}, TAccess = unknown>(
  vendorId?: ModelVendorId,
): IModelVendor<TServiceSettings, TAccess> | null {
  return vendorId ? (MODEL_VENDOR_REGISTRY[vendorId] as IModelVendor<TServiceSettings, TAccess>) ?? null : null;
}
