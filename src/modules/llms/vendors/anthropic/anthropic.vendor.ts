import { apiAsync } from '~/common/util/trpc.client';

import { AnthropicIcon } from '~/common/components/icons/AnthropicIcon';

import type { IModelVendor } from '../IModelVendor';
import type { AnthropicAccessSchema } from '../../transports/server/anthropic.router';
import type { VChatMessageIn, VChatMessageOrFunctionCallOut, VChatMessageOut } from '../../transports/chatGenerate';

import { LLMOptionsOpenAI } from '../openai/openai.vendor';
import { OpenAILLMOptions } from '../openai/OpenAILLMOptions';

import { AnthropicSourceSetup } from './AnthropicSourceSetup';


// special symbols
export const isValidAnthropicApiKey = (apiKey?: string) => !!apiKey && apiKey.startsWith('sk-') && apiKey.length > 40;

export interface SourceSetupAnthropic {
  anthropicKey: string;
  anthropicHost: string;
}

export const ModelVendorAnthropic: IModelVendor<SourceSetupAnthropic, LLMOptionsOpenAI, AnthropicAccessSchema> = {
  id: 'anthropic',
  name: 'Anthropic',
  rank: 13,
  location: 'cloud',
  instanceLimit: 1,
  hasServerKey: !!process.env.HAS_SERVER_KEY_ANTHROPIC,

  // components
  Icon: AnthropicIcon,
  SourceSetupComponent: AnthropicSourceSetup,
  LLMOptionsComponent: OpenAILLMOptions,

  // functions
  getAccess: (partialSetup): AnthropicAccessSchema => ({
    dialect: 'anthropic',
    anthropicKey: partialSetup?.anthropicKey || '',
    anthropicHost: partialSetup?.anthropicHost || '',
  }),
  callChatGenerate(llm, messages: VChatMessageIn[], maxTokens?: number): Promise<VChatMessageOut> {
    return anthropicCallChatGenerate(this.getAccess(llm._source.setup), llm.options, messages, /*null, null,*/ maxTokens);
  },
  callChatGenerateWF(): Promise<VChatMessageOrFunctionCallOut> {
    throw new Error('Anthropic does not support "Functions" yet');
  },
};


/**
 * This function either returns the LLM message, or function calls, or throws a descriptive error string
 */
async function anthropicCallChatGenerate<TOut = VChatMessageOut>(
  access: AnthropicAccessSchema, llmOptions: Partial<LLMOptionsOpenAI>, messages: VChatMessageIn[],
  // functions: VChatFunctionIn[] | null, forceFunctionName: string | null,
  maxTokens?: number,
): Promise<TOut> {
  const { llmRef, llmTemperature = 0.5, llmResponseTokens } = llmOptions;
  try {
    return await apiAsync.llmAnthropic.chatGenerate.mutate({
      access,
      model: {
        id: llmRef!,
        temperature: llmTemperature,
        maxTokens: maxTokens || llmResponseTokens || 1024,
      },
      history: messages,
    }) as TOut;
  } catch (error: any) {
    const errorMessage = error?.message || error?.toString() || 'Anthropic Chat Generate Error';
    console.error(`anthropicCallChatGenerate: ${errorMessage}`);
    throw new Error(errorMessage);
  }
}