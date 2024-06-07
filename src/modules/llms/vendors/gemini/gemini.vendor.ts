import { GeminiIcon } from '~/common/components/icons/vendors/GeminiIcon';
import { apiAsync } from '~/common/util/trpc.client';

import type { GeminiAccessSchema } from '../../server/gemini/gemini.router';
import type { GeminiBlockSafetyLevel } from '../../server/gemini/gemini.wiretypes';
import type { IModelVendor } from '../IModelVendor';
import type { VChatContextRef, VChatGenerateContextName, VChatMessageOut } from '../../llm.client';
import { unifiedStreamingClient } from '../unifiedStreamingClient';

import { FALLBACK_LLM_RESPONSE_TOKENS, FALLBACK_LLM_TEMPERATURE } from '../openai/openai.vendor';
import { OpenAILLMOptions } from '../openai/OpenAILLMOptions';

import { GeminiSourceSetup } from './GeminiSourceSetup';


export interface SourceSetupGemini {
  geminiKey: string;
  minSafetyLevel: GeminiBlockSafetyLevel;
}

export interface LLMOptionsGemini {
  llmRef: string;
  stopSequences: string[];  // up to 5 sequences that will stop generation (optional)
  candidateCount: number;   // 1...8 number of generated responses to return (optional)
  maxOutputTokens: number;  // if unset, this will default to outputTokenLimit (optional)
  temperature: number;      // 0...1 Controls the randomness of the output. (optional)
  topP: number;             // 0...1 The maximum cumulative probability of tokens to consider when sampling (optional)
  topK: number;             // 1...100 The maximum number of tokens to consider when sampling (optional)
}


export const ModelVendorGemini: IModelVendor<SourceSetupGemini, GeminiAccessSchema, LLMOptionsGemini> = {
  id: 'googleai',
  name: 'Gemini',
  rank: 11,
  location: 'cloud',
  instanceLimit: 1,
  hasBackendCapKey: 'hasLlmGemini',

  // components
  Icon: GeminiIcon,
  SourceSetupComponent: GeminiSourceSetup,
  LLMOptionsComponent: OpenAILLMOptions,

  // functions
  initializeSetup: () => ({
    geminiKey: '',
    minSafetyLevel: 'HARM_BLOCK_THRESHOLD_UNSPECIFIED',
  }),
  validateSetup: (setup) => {
    return setup.geminiKey?.length > 0;
  },
  getTransportAccess: (partialSetup): GeminiAccessSchema => ({
    dialect: 'gemini',
    geminiKey: partialSetup?.geminiKey || '',
    minSafetyLevel: partialSetup?.minSafetyLevel || 'HARM_BLOCK_THRESHOLD_UNSPECIFIED',
  }),

  // List Models
  rpcUpdateModelsOrThrow: async (access) => await apiAsync.llmGemini.listModels.query({ access }),

  // Chat Generate (non-streaming) with Functions
  rpcChatGenerateOrThrow: async (access, llmOptions, messages, contextName: VChatGenerateContextName, contextRef: VChatContextRef | null, functions, forceFunctionName, maxTokens) => {
    if (functions?.length || forceFunctionName)
      throw new Error('Gemini does not support functions');

    const { llmRef, temperature, maxOutputTokens } = llmOptions;
    try {
      return await apiAsync.llmGemini.chatGenerate.mutate({
        access,
        model: {
          id: llmRef,
          temperature: temperature ?? FALLBACK_LLM_TEMPERATURE,
          maxTokens: maxTokens || maxOutputTokens || FALLBACK_LLM_RESPONSE_TOKENS,
        },
        history: messages,
        context: contextRef ? {
          method: 'chat-generate',
          name: contextName,
          ref: contextRef,
        } : undefined,
      }) as VChatMessageOut;
    } catch (error: any) {
      const errorMessage = error?.message || error?.toString() || 'Gemini Chat Generate Error';
      console.error(`gemini.rpcChatGenerateOrThrow: ${errorMessage}`);
      throw new Error(errorMessage);
    }
  },

  // Chat Generate (streaming) with Functions
  streamingChatGenerateOrThrow: unifiedStreamingClient,

};
