import { AnthropicIcon } from '~/common/components/icons/vendors/AnthropicIcon';
import { apiAsync } from '~/common/util/trpc.client';

import type { AnthropicAccessSchema } from '../../server/anthropic/anthropic.router';
import type { IModelVendor } from '../IModelVendor';
import type { VChatContextRef, VChatGenerateContextName, VChatMessageOut } from '../../llm.client';
import { unifiedStreamingClient } from '../unifiedStreamingClient';

import { FALLBACK_LLM_RESPONSE_TOKENS, FALLBACK_LLM_TEMPERATURE, LLMOptionsOpenAI } from '../openai/openai.vendor';
import { OpenAILLMOptions } from '../openai/OpenAILLMOptions';

import { AnthropicSourceSetup } from './AnthropicSourceSetup';


// special symbols
export const isValidAnthropicApiKey = (apiKey?: string) => !!apiKey && (apiKey.startsWith('sk-') ? apiKey.length >= 39 : apiKey.length > 1);

export interface SourceSetupAnthropic {
  anthropicKey: string;
  anthropicHost: string;
  heliconeKey: string;
}

export const ModelVendorAnthropic: IModelVendor<SourceSetupAnthropic, AnthropicAccessSchema, LLMOptionsOpenAI> = {
  id: 'anthropic',
  name: 'Anthropic',
  rank: 13,
  location: 'cloud',
  instanceLimit: 1,
  hasBackendCapKey: 'hasLlmAnthropic',

  // components
  Icon: AnthropicIcon,
  SourceSetupComponent: AnthropicSourceSetup,
  LLMOptionsComponent: OpenAILLMOptions,

  // functions
  getTransportAccess: (partialSetup): AnthropicAccessSchema => ({
    dialect: 'anthropic',
    anthropicKey: partialSetup?.anthropicKey || '',
    anthropicHost: partialSetup?.anthropicHost || null,
    heliconeKey: partialSetup?.heliconeKey || null,
  }),


  // List Models
  rpcUpdateModelsOrThrow: async (access) => await apiAsync.llmAnthropic.listModels.query({ access }),

  // Chat Generate (non-streaming) with Functions
  rpcChatGenerateOrThrow: async (access, llmOptions, messages, contextName: VChatGenerateContextName, contextRef: VChatContextRef | null, functions, forceFunctionName, maxTokens) => {
    if (functions?.length || forceFunctionName)
      throw new Error('Anthropic does not support functions');

    const { llmRef, llmTemperature, llmResponseTokens } = llmOptions;
    try {
      return await apiAsync.llmAnthropic.chatGenerateMessage.mutate({
        access,
        model: {
          id: llmRef,
          temperature: llmTemperature ?? FALLBACK_LLM_TEMPERATURE,
          maxTokens: maxTokens || llmResponseTokens || FALLBACK_LLM_RESPONSE_TOKENS,
        },
        history: messages,
        context: contextRef ? {
          method: 'chat-generate',
          name: contextName,
          ref: contextRef,
        } : undefined,
      }) as VChatMessageOut;
    } catch (error: any) {
      const errorMessage = error?.message || error?.toString() || 'Anthropic Chat Generate Error';
      console.error(`anthropic.rpcChatGenerateOrThrow: ${errorMessage}`);
      throw new Error(errorMessage);
    }
  },

  // Chat Generate (streaming) with Functions
  streamingChatGenerateOrThrow: unifiedStreamingClient,

};
