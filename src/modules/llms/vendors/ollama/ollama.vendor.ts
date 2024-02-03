import { backendCaps } from '~/modules/backend/state-backend';

import { OllamaIcon } from '~/common/components/icons/vendors/OllamaIcon';
import { apiAsync, apiQuery } from '~/common/util/trpc.client';

import type { IModelVendor } from '../IModelVendor';
import type { OllamaAccessSchema } from '../../server/ollama/ollama.router';
import type { VChatMessageOut } from '../../llm.client';
import { unifiedStreamingClient } from '../unifiedStreamingClient';

import { FALLBACK_LLM_RESPONSE_TOKENS, FALLBACK_LLM_TEMPERATURE, LLMOptionsOpenAI } from '../openai/openai.vendor';
import { OpenAILLMOptions } from '../openai/OpenAILLMOptions';

import { OllamaSourceSetup } from './OllamaSourceSetup';


export interface SourceSetupOllama {
  ollamaHost: string;
}


export const ModelVendorOllama: IModelVendor<SourceSetupOllama, OllamaAccessSchema, LLMOptionsOpenAI> = {
  id: 'ollama',
  name: 'Ollama',
  rank: 20,
  location: 'local',
  instanceLimit: 2,
  hasBackendCap: () => backendCaps().hasLlmOllama,

  // components
  Icon: OllamaIcon,
  SourceSetupComponent: OllamaSourceSetup,
  LLMOptionsComponent: OpenAILLMOptions,

  // functions
  getTransportAccess: (partialSetup): OllamaAccessSchema => ({
    dialect: 'ollama',
    ollamaHost: partialSetup?.ollamaHost || '',
  }),

  // List Models
  rpcUpdateModelsQuery: (access, enabled, onSuccess) => {
    return apiQuery.llmOllama.listModels.useQuery({ access }, {
      enabled: enabled,
      onSuccess: onSuccess,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
    });
  },

  // Chat Generate (non-streaming) with Functions
  rpcChatGenerateOrThrow: async (access, llmOptions, messages, functions, forceFunctionName, maxTokens) => {
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
