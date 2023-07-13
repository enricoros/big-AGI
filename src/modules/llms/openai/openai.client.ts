import { apiAsync } from '~/modules/trpc/trpc.client';

import type { DLLM } from '../llm.types';
import type { VChatFunctionIn, VChatMessageIn, VChatMessageOrFunctionCallOut, VChatMessageOut } from '../llm.client';
import { normalizeOAISetup, SourceSetupOpenAI } from './openai.vendor';


export const hasServerKeyOpenAI = !!process.env.HAS_SERVER_KEY_OPENAI;

export const isValidOpenAIApiKey = (apiKey?: string) => !!apiKey && apiKey.startsWith('sk-') && apiKey.length > 40;


export async function openAICallChat(llm: DLLM, messages: VChatMessageIn[], maxTokens?: number) {
  return openAICallChatOverloaded<VChatMessageOut>(llm, messages, null, maxTokens);
}

export async function openAICallChatWithFunctions(llm: DLLM, messages: VChatMessageIn[], functions: VChatFunctionIn[], maxTokens?: number) {
  return openAICallChatOverloaded<VChatMessageOrFunctionCallOut>(llm, messages, functions, maxTokens);
}


/**
 * This function either returns the LLM message, or function calls, or throws a descriptive error string
 */
async function openAICallChatOverloaded<TOut = VChatMessageOut | VChatMessageOrFunctionCallOut>(llm: DLLM, messages: VChatMessageIn[], functions: VChatFunctionIn[] | null, maxTokens?: number): Promise<TOut> {
  // access params (source)
  const partialSetup = llm._source.setup as Partial<SourceSetupOpenAI>;
  const sourceSetupOpenAI = normalizeOAISetup(partialSetup);

  // model params (llm)
  const openaiLlmRef = llm.options.llmRef!;
  const modelTemperature = llm.options.llmTemperature || 0.5;

  try {
    return await apiAsync.openai.chatGenerateWithFunctions.mutate({
      access: sourceSetupOpenAI,
      model: {
        id: openaiLlmRef,
        temperature: modelTemperature,
        ...(maxTokens && { maxTokens }),
      },
      functions: functions ?? undefined,
      history: messages,
    }) as TOut;
    // errorMessage = `issue fetching: ${response.status} · ${response.statusText}${errorPayload ? ' · ' + JSON.stringify(errorPayload) : ''}`;
  } catch (error: any) {
    const errorMessage = error?.message || error?.toString() || 'OpenAI Chat Fetch Error';
    console.error(`callChat: ${errorMessage}`);
    throw new Error(errorMessage);
  }
}