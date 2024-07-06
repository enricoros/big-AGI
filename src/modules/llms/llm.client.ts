import { sendGAEvent } from '@next/third-parties/google';

import { hasGoogleAnalytics } from '~/common/components/GoogleAnalytics';

import type { GenerateContextNameSchema, ModelDescriptionSchema, StreamingContextNameSchema } from './server/llm.server.types';
import type { OpenAIWire } from './server/openai/openai.wiretypes';
import type { StreamingClientUpdate } from './vendors/unifiedStreamingClient';
import { DLLM, DLLMId, DModelSource, DModelSourceId, LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, useModelsStore } from './store-llms';
import { FALLBACK_LLM_TEMPERATURE } from './vendors/openai/openai.vendor';
import { findAccessForSourceOrThrow, findVendorForLlmOrThrow } from './vendors/vendors.registry';


// LLM Client Types
// NOTE: Model List types in '../server/llm.server.types';

export interface VChatMessageIn {
  role: 'assistant' | 'system' | 'user'; // | 'function';
  content: string;
  //name?: string; // when role: 'function'
}

export type VChatFunctionIn = OpenAIWire.ChatCompletion.RequestFunctionDef;

export type VChatStreamContextName = StreamingContextNameSchema;
export type VChatGenerateContextName = GenerateContextNameSchema;
export type VChatContextRef = string;

export interface VChatMessageOut {
  role: 'assistant' | 'system' | 'user';
  content: string;
  finish_reason: 'stop' | 'length' | null;
}

export interface VChatMessageOrFunctionCallOut extends VChatMessageOut {
  function_name: string;
  function_arguments: object | null;
}


// LLM Client Functions

export async function llmsUpdateModelsForSourceOrThrow(sourceId: DModelSourceId, keepUserEdits: boolean): Promise<{ models: ModelDescriptionSchema[] }> {

  // get the access, assuming there's no client config and the server will do all
  const { source, vendor, transportAccess } = findAccessForSourceOrThrow(sourceId);

  // fetch models
  const data = await vendor.rpcUpdateModelsOrThrow(transportAccess);

  // update the global models store
  useModelsStore.getState().setLLMs(
    data.models.map(model => modelDescriptionToDLLMOpenAIOptions(model, source)),
    source.id,
    true,
    keepUserEdits,
  );

  // figure out which vendors are actually used and useful
  hasGoogleAnalytics && sendGAEvent('event', 'app_models_updated', {
    app_models_source_id: source.id,
    app_models_source_label: source.label,
    app_models_updated_count: data.models.length || 0,
    app_models_vendor_id: vendor.id,
    app_models_vendor_label: vendor.name,
  });

  // return the fetched models
  return data;
}

function modelDescriptionToDLLMOpenAIOptions<TSourceSetup, TLLMOptions>(model: ModelDescriptionSchema, source: DModelSource<TSourceSetup>): DLLM<TSourceSetup, TLLMOptions> {

  // null means unknown contenxt/output tokens
  const contextTokens = model.contextWindow || null;
  const maxOutputTokens = model.maxCompletionTokens || (contextTokens ? Math.round(contextTokens / 2) : null);
  const llmResponseTokensRatio = model.maxCompletionTokens ? 1 : 1 / 4;
  const llmResponseTokens = maxOutputTokens ? Math.round(maxOutputTokens * llmResponseTokensRatio) : null;

  return {
    id: `${source.id}-${model.id}`,

    // editable properties
    label: model.label,
    created: model.created || 0,
    updated: model.updated || 0,
    description: model.description,
    hidden: !!model.hidden,
    // isEdited: false, // NOTE: this is set by the store on user edits

    // hard properties
    contextTokens,
    maxOutputTokens,
    trainingDataCutoff: model.trainingDataCutoff,
    interfaces: model.interfaces?.length ? model.interfaces : [LLM_IF_OAI_Chat],
    // inputTypes: ...
    benchmark: model.benchmark,
    pricing: model.pricing,

    // derived properties
    tmpIsFree: model.pricing?.chatIn === 0 && model.pricing?.chatOut === 0,
    tmpIsVision: model.interfaces?.includes(LLM_IF_OAI_Chat) === true,

    sId: source.id,
    _source: source,

    options: {
      llmRef: model.id,
      // @ts-ignore FIXME: large assumption that this is LLMOptionsOpenAI object
      llmTemperature: FALLBACK_LLM_TEMPERATURE,
      llmResponseTokens,
    },
  };
}


export async function llmChatGenerateOrThrow<TSourceSetup = unknown, TAccess = unknown, TLLMOptions = unknown>(
  llmId: DLLMId,
  messages: VChatMessageIn[],
  contextName: VChatGenerateContextName,
  contextRef: VChatContextRef | null,
  functions: VChatFunctionIn[] | null,
  forceFunctionName: string | null,
  maxTokens?: number,
): Promise<VChatMessageOut | VChatMessageOrFunctionCallOut> {

  // id to DLLM and vendor
  const { llm, vendor } = findVendorForLlmOrThrow<TSourceSetup, TAccess, TLLMOptions>(llmId);

  // if the model does not support function calling and we're trying to force a function, throw
  if (forceFunctionName && !llm.interfaces.includes(LLM_IF_OAI_Fn))
    throw new Error(`Model ${llmId} does not support function calling`);

  // FIXME: relax the forced cast
  const options = llm.options as TLLMOptions;

  // get the access
  const partialSourceSetup = llm._source.setup;
  const access = vendor.getTransportAccess(partialSourceSetup);

  // get any vendor-specific rate limit delay
  const delay = vendor.getRateLimitDelay?.(llm, partialSourceSetup) ?? 0;
  if (delay > 0)
    await new Promise(resolve => setTimeout(resolve, delay));

  // execute via the vendor
  return await vendor.rpcChatGenerateOrThrow(access, options, messages, contextName, contextRef, functions, forceFunctionName, maxTokens);
}


export async function llmStreamingChatGenerate<TSourceSetup = unknown, TAccess = unknown, TLLMOptions = unknown>(
  llmId: DLLMId,
  messages: VChatMessageIn[],
  contextName: VChatStreamContextName,
  contextRef: VChatContextRef,
  functions: VChatFunctionIn[] | null,
  forceFunctionName: string | null,
  abortSignal: AbortSignal,
  onUpdate: (update: StreamingClientUpdate, done: boolean) => void,
): Promise<void> {

  // id to DLLM and vendor
  const { llm, vendor } = findVendorForLlmOrThrow<TSourceSetup, TAccess, TLLMOptions>(llmId);

  // FIXME: relax the forced cast
  const llmOptions = llm.options as TLLMOptions;

  // get the access
  const partialSourceSetup = llm._source.setup;
  const access = vendor.getTransportAccess(partialSourceSetup); // as ChatStreamInputSchema['access'];

  // get any vendor-specific rate limit delay
  const delay = vendor.getRateLimitDelay?.(llm, partialSourceSetup) ?? 0;
  if (delay > 0)
    await new Promise(resolve => setTimeout(resolve, delay));

  // execute via the vendor
  return await vendor.streamingChatGenerateOrThrow(access, llmId, llmOptions, messages, contextName, contextRef, functions, forceFunctionName, abortSignal, onUpdate);
}
