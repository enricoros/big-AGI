import { apiAsync } from '~/modules/trpc/trpc.client';

import { DLLM, ModelVendor } from '../llm.types';
import { VChatFunctionIn, VChatMessageIn, VChatMessageOrFunctionCallOut, VChatMessageOut } from '../llm.client';

import { OpenAIIcon } from './OpenAIIcon';
import { OpenAILLMOptions } from './OpenAILLMOptions';
import { OpenAISourceSetup } from './OpenAISourceSetup';


// special symbols
export const hasServerKeyOpenAI = !!process.env.HAS_SERVER_KEY_OPENAI;
export const isValidOpenAIApiKey = (apiKey?: string) => !!apiKey && apiKey.startsWith('sk-') && apiKey.length > 40;


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
  llmResponseTokens: number;
}

export const ModelVendorOpenAI: ModelVendor<SourceSetupOpenAI, LLMOptionsOpenAI> = {
  id: 'openai',
  name: 'OpenAI',
  rank: 10,
  location: 'cloud',
  instanceLimit: 1,

  // components
  Icon: OpenAIIcon,
  SourceSetupComponent: OpenAISourceSetup,
  LLMOptionsComponent: OpenAILLMOptions,

  // functions
  normalizeSetup: (partialSetup?: Partial<SourceSetupOpenAI>): SourceSetupOpenAI => ({
    oaiKey: '',
    oaiOrg: '',
    oaiHost: '',
    heliKey: '',
    moderationCheck: false,
    ...partialSetup,
  }),
  callChat: (llm: DLLM<LLMOptionsOpenAI>, messages: VChatMessageIn[], maxTokens?: number) => {
    return openAICallChatOverloaded<VChatMessageOut>(llm, messages, null, maxTokens);
  },
  callChatWithFunctions: (llm: DLLM<LLMOptionsOpenAI>, messages: VChatMessageIn[], functions: VChatFunctionIn[], maxTokens?: number) => {
    return openAICallChatOverloaded<VChatMessageOrFunctionCallOut>(llm, messages, functions, maxTokens);
  },
};


/**
 * This function either returns the LLM message, or function calls, or throws a descriptive error string
 */
async function openAICallChatOverloaded<TOut = VChatMessageOut | VChatMessageOrFunctionCallOut>(
  llm: DLLM<LLMOptionsOpenAI>, messages: VChatMessageIn[], functions: VChatFunctionIn[] | null, maxTokens?: number,
): Promise<TOut> {
  // access params (source)
  const openAISetup = ModelVendorOpenAI.normalizeSetup(llm._source.setup as Partial<SourceSetupOpenAI>);

  // model params (llm)
  const { llmRef, llmTemperature = 0.5, llmResponseTokens } = llm.options;

  try {
    return await apiAsync.llmOpenAI.chatGenerateWithFunctions.mutate({
      access: openAISetup,
      model: {
        id: llmRef!,
        temperature: llmTemperature,
        maxTokens: maxTokens || llmResponseTokens || 1024,
      },
      functions: functions ?? undefined,
      history: messages,
    }) as TOut;
  } catch (error: any) {
    const errorMessage = error?.message || error?.toString() || 'OpenAI Chat Fetch Error';
    console.error(`openAICallChat: ${errorMessage}`);
    throw new Error(errorMessage);
  }
}