import { backendCaps } from '~/modules/backend/state-backend';

import { OllamaIcon } from '~/common/components/icons/OllamaIcon';
import { apiAsync, apiQuery } from '~/common/util/trpc.client';

import type { IModelVendor } from '../IModelVendor';
import type { OllamaAccessSchema } from '../../server/ollama/ollama.router';
import type { VChatMessageOut } from '../../client/llm.client.types';

import type { LLMOptionsOpenAI } from '../openai/openai.vendor';
import { OpenAILLMOptions } from '../openai/OpenAILLMOptions';

import { OllamaSourceSetup } from './OllamaSourceSetup';


export interface SourceSetupOllama {
  ollamaHost: string;
}


export const ModelVendorOllama: IModelVendor<SourceSetupOllama, OllamaAccessSchema, LLMOptionsOpenAI> = {
  id: 'ollama',
  name: 'Ollama',
  rank: 22,
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

    const { llmRef, llmTemperature = 0.5, llmResponseTokens } = llmOptions;
    try {
      return await apiAsync.llmOllama.chatGenerate.mutate({
        access,
        model: {
          id: llmRef!,
          temperature: llmTemperature,
          maxTokens: maxTokens || llmResponseTokens || 1024,
        },
        history: messages,
      }) as VChatMessageOut;
    } catch (error: any) {
      const errorMessage = error?.message || error?.toString() || 'Ollama Chat Generate Error';
      console.error(`ollama.rpcChatGenerateOrThrow: ${errorMessage}`);
      throw new Error(errorMessage);
    }
  },

};
