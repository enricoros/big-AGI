import { apiAsync } from '~/modules/trpc/trpc.client';

import { AnthropicIcon } from '~/common/components/icons/AnthropicIcon';

import { DLLM } from '../../store-llms';
import { IModelVendor } from '../IModelVendor';
import { VChatMessageIn, VChatMessageOut } from '../../transports/chatGenerate';

import { LLMOptionsOpenAI } from '../openai/openai.vendor';
import { OpenAILLMOptions } from '../openai/OpenAILLMOptions';

import { AnthropicSourceSetup } from './AnthropicSourceSetup';


// special symbols
export const hasServerKeyAnthropic = !!process.env.HAS_SERVER_KEY_ANTHROPIC;
export const isValidAnthropicApiKey = (apiKey?: string) => !!apiKey && apiKey.startsWith('sk-') && apiKey.length > 40;

export interface SourceSetupAnthropic {
  anthropicKey: string;
  anthropicHost: string;
}

export const ModelVendorAnthropic: IModelVendor<SourceSetupAnthropic, LLMOptionsOpenAI> = {
  id: 'anthropic',
  name: 'Anthropic',
  rank: 13,
  location: 'cloud',
  instanceLimit: 1,

  // components
  Icon: AnthropicIcon,
  SourceSetupComponent: AnthropicSourceSetup,
  LLMOptionsComponent: OpenAILLMOptions,

  // functions
  normalizeSetup: (partialSetup?: Partial<SourceSetupAnthropic>): SourceSetupAnthropic => ({
    anthropicKey: '',
    anthropicHost: '',
    ...partialSetup,
  }),
  callChat: anthropicCallChat,
  callChatWithFunctions: () => {
    throw new Error('Anthropic does not support "Functions" yet');
  },
};


/**
 * This function either returns the LLM message, or function calls, or throws a descriptive error string
 */
async function anthropicCallChat<TOut = VChatMessageOut>(
  llm: DLLM<LLMOptionsOpenAI>, messages: VChatMessageIn[], maxTokens?: number,
): Promise<TOut> {
  // access params (source)
  const anthropicSetup = ModelVendorAnthropic.normalizeSetup(llm._source.setup as Partial<SourceSetupAnthropic>);

  // model params (llm)
  const { llmRef, llmTemperature = 0.5, llmResponseTokens } = llm.options;

  try {
    return await apiAsync.llmAnthropic.chatGenerate.mutate({
      access: anthropicSetup,
      model: {
        id: llmRef!,
        temperature: llmTemperature,
        maxTokens: maxTokens || llmResponseTokens || 1024,
      },
      history: messages,
    }) as TOut;
  } catch (error: any) {
    const errorMessage = error?.message || error?.toString() || 'Anthropic Chat Fetch Error';
    console.error(`anthropicCallChat: ${errorMessage}`);
    throw new Error(errorMessage);
  }
}