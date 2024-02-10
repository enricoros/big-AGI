import type { DLLMId } from './store-llms';
import type { OpenAIWire } from './server/openai/openai.wiretypes';
import type { StreamingClientUpdate } from './vendors/unifiedStreamingClient';
import { findVendorForLlmOrThrow } from './vendors/vendors.registry';


// LLM Client Types
// NOTE: Model List types in '../server/llm.server.types';

export interface VChatMessageIn {
  role: 'assistant' | 'system' | 'user'; // | 'function';
  content: string;
  //name?: string; // when role: 'function'
}

export type VChatFunctionIn = OpenAIWire.ChatCompletion.RequestFunctionDef;

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

export async function llmChatGenerateOrThrow<TSourceSetup = unknown, TAccess = unknown, TLLMOptions = unknown>(
  llmId: DLLMId,
  messages: VChatMessageIn[],
  functions: VChatFunctionIn[] | null, forceFunctionName: string | null,
  maxTokens?: number,
): Promise<VChatMessageOut | VChatMessageOrFunctionCallOut> {

  // id to DLLM and vendor
  const { llm, vendor } = findVendorForLlmOrThrow<TSourceSetup, TAccess, TLLMOptions>(llmId);

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
  return await vendor.rpcChatGenerateOrThrow(access, options, messages, functions, forceFunctionName, maxTokens);
}


export async function llmStreamingChatGenerate<TSourceSetup = unknown, TAccess = unknown, TLLMOptions = unknown>(
  llmId: DLLMId,
  messages: VChatMessageIn[],
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
  return await vendor.streamingChatGenerateOrThrow(access, llmId, llmOptions, messages, functions, forceFunctionName, abortSignal, onUpdate);
}
