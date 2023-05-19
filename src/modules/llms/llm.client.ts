import { DLLMId } from '~/modules/llms/llm.types';
import { OpenAI } from '~/modules/openai/openai.types';
import { findVendorById } from '~/modules/llms/vendor.registry';
import { useModelsStore } from '~/modules/llms/store-llms';


export async function callChat(llmId: DLLMId, messages: OpenAI.Wire.Chat.Message[], maxTokens?: number): Promise<OpenAI.API.Chat.Response> {

  // get the vendor
  const llm = useModelsStore.getState().llms.find(llm => llm.id === llmId);
  const vendor = findVendorById(llm?._source.vId);
  if (!llm || !vendor) throw new Error(`callChat: Vendor not found for LLM ${llmId}`);

  // go for it
  return await vendor.callChat(llm, messages, maxTokens);
}