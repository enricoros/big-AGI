import GoogleIcon from '@mui/icons-material/Google';

import { backendCaps } from '~/modules/backend/state-backend';

import { apiAsync, apiQuery } from '~/common/util/trpc.client';

import type { GeminiAccessSchema } from '../../transports/server/gemini/gemini.router';
import type { IModelVendor } from '../IModelVendor';
import type { ModelDescriptionSchema } from '../../transports/server/server.schemas';
import type { VChatMessageIn, VChatMessageOrFunctionCallOut, VChatMessageOut } from '../../transports/chatGenerate';

import { OpenAILLMOptions } from '../openai/OpenAILLMOptions';

import { GeminiSourceSetup } from './GeminiSourceSetup';


export interface SourceSetupGemini {
  geminiKey: string;
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
  hasBackendCap: () => backendCaps().hasLlmGemini,

  // components
  Icon: GoogleIcon,
  SourceSetupComponent: GeminiSourceSetup,
  LLMOptionsComponent: OpenAILLMOptions,

  // functions
  initializeSetup: () => ({
    geminiKey: '',
  }),
  validateSetup: (setup) => {
    return setup.geminiKey?.length > 0;
  },
  getTransportAccess: (partialSetup): GeminiAccessSchema => ({
    dialect: 'gemini',
    geminiKey: partialSetup?.geminiKey || '',
  }),
  callChatGenerate(llm, messages: VChatMessageIn[], maxTokens?: number): Promise<VChatMessageOut> {
    return geminiCallChatGenerate(this.getTransportAccess(llm._source.setup), llm.options, messages, maxTokens);
  },
  callChatGenerateWF(): Promise<VChatMessageOrFunctionCallOut> {
    throw new Error('Gemini does not support "Functions" yet');
  },
};


export function geminiListModelsQuery(access: GeminiAccessSchema, enabled: boolean, onSuccess: (data: { models: ModelDescriptionSchema[] }) => void) {
  return apiQuery.llmGemini.listModels.useQuery({ access }, {
    enabled: enabled,
    onSuccess: onSuccess,
    refetchOnWindowFocus: false,
    staleTime: Infinity,
  });
}


/**
 * This function either returns the LLM message, or throws a descriptive error string
 */
async function geminiCallChatGenerate<TOut = VChatMessageOut>(
  access: GeminiAccessSchema, llmOptions: Partial<LLMOptionsGemini>, messages: VChatMessageIn[],
  maxTokens?: number,
): Promise<TOut> {
  const { llmRef, temperature = 0.5, maxOutputTokens } = llmOptions;
  try {
    return await apiAsync.llmGemini.chatGenerate.mutate({
      access,
      model: {
        id: llmRef!,
        temperature: temperature,
        maxTokens: maxTokens || maxOutputTokens || 1024,
      },
      history: messages,
    }) as TOut;
  } catch (error: any) {
    const errorMessage = error?.message || error?.toString() || 'Gemini Chat Generate Error';
    console.error(`geminiCallChatGenerate: ${errorMessage}`);
    throw new Error(errorMessage);
  }
}

