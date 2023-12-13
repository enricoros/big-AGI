import type { DLLMId } from '../store-llms';
import type { OpenAIWire } from './server/openai/openai.wiretypes';
import { findVendorForLlmOrThrow } from '../vendors/vendors.registry';


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


export async function callChatGenerate(llmId: DLLMId, messages: VChatMessageIn[], maxTokens?: number): Promise<VChatMessageOut> {
  const { llm, vendor } = findVendorForLlmOrThrow(llmId);
  return await vendor.callChatGenerate(llm, messages, maxTokens);
}

export async function callChatGenerateWithFunctions(llmId: DLLMId, messages: VChatMessageIn[], functions: VChatFunctionIn[], forceFunctionName: string | null, maxTokens?: number): Promise<VChatMessageOrFunctionCallOut> {
  const { llm, vendor } = findVendorForLlmOrThrow(llmId);
  return await vendor.callChatGenerateWF(llm, messages, functions, forceFunctionName, maxTokens);
}