import type { DLLMId } from '../store-llms';
import { findVendorForLlmOrThrow } from '../vendors/vendors.registry';

import type { VChatFunctionIn, VChatMessageIn, VChatMessageOrFunctionCallOut, VChatMessageOut } from './llm.client.types';


export async function llmChatGenerate(llmId: DLLMId, messages: VChatMessageIn[], maxTokens?: number): Promise<VChatMessageOut> {
  const { llm, vendor } = findVendorForLlmOrThrow(llmId);
  return await vendor.callChatGenerate(llm, messages, maxTokens);
}

export async function llmChatGenerateWithFunctions(llmId: DLLMId, messages: VChatMessageIn[], functions: VChatFunctionIn[], forceFunctionName: string | null, maxTokens?: number): Promise<VChatMessageOrFunctionCallOut> {
  const { llm, vendor } = findVendorForLlmOrThrow(llmId);
  return await vendor.callChatGenerateWF(llm, messages, functions, forceFunctionName, maxTokens);
}