import { OpenAIIcon } from '~/common/components/icons/vendors/OpenAIIcon';
import { apiAsync } from '~/common/util/trpc.client';

import type { IModelVendor } from '../IModelVendor';
import type { OpenAIAccessSchema } from '../../server/openai/openai.router';
import type { VChatContextRef, VChatGenerateContextName, VChatMessageOrFunctionCallOut } from '../../llm.client';
import { unifiedStreamingClient } from '../unifiedStreamingClient';

import { OpenAILLMOptions } from './OpenAILLMOptions';
import { OpenAISourceSetup } from './OpenAISourceSetup';


// shared constants
export const FALLBACK_LLM_RESPONSE_TOKENS = 1024;
export const FALLBACK_LLM_TEMPERATURE = 0.5;


// special symbols
// export const isValidOpenAIApiKey = (apiKey?: string) => !!apiKey && apiKey.startsWith('sk-') && apiKey.length > 40;

export interface SourceSetupOpenAI {
  oaiKey: string;
  oaiOrg: string;
  oaiHost: string;  // use OpenAI-compatible non-default hosts (full origin path)
  heliKey: string;  // helicone key (works in conjunction with oaiHost)
  moderationCheck: boolean;
}

export interface LLMOptionsOpenAI {
  llmRef: string;
  llmTemperature: number;
  llmResponseTokens: number | null;
}

export const ModelVendorOpenAI: IModelVendor<SourceSetupOpenAI, OpenAIAccessSchema, LLMOptionsOpenAI> = {
  id: 'openai',
  name: 'OpenAI',
  rank: 10,
  location: 'cloud',
  instanceLimit: 5,
  hasBackendCapKey: 'hasLlmOpenAI',

  // components
  Icon: OpenAIIcon,
  SourceSetupComponent: OpenAISourceSetup,
  LLMOptionsComponent: OpenAILLMOptions,

  // functions
  getTransportAccess: (partialSetup): OpenAIAccessSchema => ({
    dialect: 'openai',
    oaiKey: '',
    oaiOrg: '',
    oaiHost: '',
    heliKey: '',
    moderationCheck: false,
    ...partialSetup,
  }),

  // List Models
  rpcUpdateModelsOrThrow: async (access) => await apiAsync.llmOpenAI.listModels.query({ access }),

  // Chat Generate (non-streaming) with Functions
  rpcChatGenerateOrThrow: async (access, llmOptions, messages, contextName: VChatGenerateContextName, contextRef: VChatContextRef | null, functions, forceFunctionName, maxTokens) => {
    const { llmRef, llmTemperature, llmResponseTokens } = llmOptions;
    try {
      return await apiAsync.llmOpenAI.chatGenerateWithFunctions.mutate({
        access,
        model: {
          id: llmRef,
          temperature: llmTemperature ?? FALLBACK_LLM_TEMPERATURE,
          maxTokens: maxTokens || llmResponseTokens || FALLBACK_LLM_RESPONSE_TOKENS,
        },
        functions: functions ?? undefined,
        forceFunctionName: forceFunctionName ?? undefined,
        history: messages,
        context: contextRef ? {
          method: 'chat-generate',
          name: contextName,
          ref: contextRef,
        } : undefined,
      }) as VChatMessageOrFunctionCallOut;
    } catch (error: any) {
      const errorMessage = error?.message || error?.toString() || 'OpenAI Chat Generate Error';
      console.error(`openai.rpcChatGenerateOrThrow: ${errorMessage}`);
      throw new Error(errorMessage);
    }
  },

  // Chat Generate (streaming) with Functions
  streamingChatGenerateOrThrow: unifiedStreamingClient,

};
