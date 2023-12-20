import type { DLLMId } from '../store-llms';
import { findVendorForLlmOrThrow } from '../vendors/vendors.registry';

import type { VChatFunctionIn, VChatMessageIn, VChatMessageOrFunctionCallOut, VChatMessageOut } from './llm.client.types';


export async function llmChatGenerateOrThrow<TSourceSetup = unknown, TAccess = unknown, TLLMOptions = unknown>(
  llmId: DLLMId, messages: VChatMessageIn[], functions: VChatFunctionIn[] | null, forceFunctionName: string | null, maxTokens?: number,
): Promise<VChatMessageOut | VChatMessageOrFunctionCallOut> {

  // id to DLLM and vendor
  const { llm, vendor } = findVendorForLlmOrThrow<TSourceSetup, TAccess, TLLMOptions>(llmId);

  // FIXME: relax the forced cast
  const options = llm.options as TLLMOptions;

  // get the access
  const partialSourceSetup = llm._source.setup;
  const access = vendor.getTransportAccess(partialSourceSetup);

  // execute via the vendor
  return await vendor.rpcChatGenerateOrThrow(access, options, messages, functions, forceFunctionName, maxTokens);
}
