import { OllamaIcon } from '~/common/components/icons/vendors/OllamaIcon';
import { apiAsync } from '~/common/util/trpc.client';

import type { IModelVendor } from '../IModelVendor';
import type { OllamaAccessSchema } from '../../server/ollama/ollama.router';
import type { VChatContextRef, VChatGenerateContextName, VChatMessageOut } from '../../llm.client';
import { unifiedStreamingClient } from '../unifiedStreamingClient';

import { FALLBACK_LLM_RESPONSE_TOKENS, FALLBACK_LLM_TEMPERATURE, LLMOptionsOpenAI } from '../openai/openai.vendor';
import { OpenAILLMOptions } from '../openai/OpenAILLMOptions';

import { OllamaSourceSetup } from './OllamaSourceSetup';


export interface SourceSetupOllama {
  ollamaHost: string;
  ollamaJson: boolean;
}


export const ModelVendorOllama: IModelVendor<SourceSetupOllama, OllamaAccessSchema, LLMOptionsOpenAI> = {
  id: 'ollama',
  name: 'Ollama',
  rank: 22,
  location: 'local',
  instanceLimit: 2,
  hasBackendCapKey: 'hasLlmOllama',

  // components
  Icon: OllamaIcon,
  SourceSetupComponent: OllamaSourceSetup,
  LLMOptionsComponent: OpenAILLMOptions,

  // functions
  getTransportAccess: (partialSetup): OllamaAccessSchema => ({
    dialect: 'ollama',
    ollamaHost: partialSetup?.ollamaHost || '',
    ollamaJson: partialSetup?.ollamaJson || false,
  }),

  // List Models
  rpcUpdateModelsOrThrow: async (access) => await apiAsync.llmOllama.listModels.query({ access }),

  // Chat Generate (non-streaming) with Functions
  rpcChatGenerateOrThrow: async (access, llmOptions, messages, contextName: VChatGenerateContextName, contextRef: VChatContextRef | null, functions, forceFunctionName, maxTokens) => {
    if (functions?.length || forceFunctionName)
      throw new Error('Ollama does not support functions');

    const { llmRef, llmTemperature, llmResponseTokens } = llmOptions;
    try {
      return await apiAsync.llmOllama.chatGenerate.mutate({
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
      const errorMessage = error?.message || error?.toString() || 'Ollama Chat Generate Error';
      console.error(`ollama.rpcChatGenerateOrThrow: ${errorMessage}`);
      throw new Error(errorMessage);
    }
  },

  // Chat Generate (streaming) with Functions
  streamingChatGenerateOrThrow: unifiedStreamingClient,

};
