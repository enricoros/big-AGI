import { backendCaps } from '~/modules/backend/state-backend';

import { OpenAIIcon } from '~/common/components/icons/OpenAIIcon';
import { apiAsync } from '~/common/util/trpc.client';

import type { IModelVendor } from '../IModelVendor';
import type { OpenAIAccessSchema } from '../../transports/server/openai/openai.router';
import type { VChatFunctionIn, VChatMessageIn, VChatMessageOrFunctionCallOut, VChatMessageOut } from '../../transports/chatGenerate';

import { OpenAILLMOptions } from './OpenAILLMOptions';
import { OpenAISourceSetup } from './OpenAISourceSetup';


// special symbols
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

export const ModelVendorOpenAI: IModelVendor<SourceSetupOpenAI, OpenAIAccessSchema, LLMOptionsOpenAI> = {
  id: 'openai',
  name: 'OpenAI',
  rank: 10,
  location: 'cloud',
  instanceLimit: 1,
  hasBackendCap: () => backendCaps().hasLlmOpenAI,

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
  callChatGenerate(llm, messages: VChatMessageIn[], maxTokens?: number): Promise<VChatMessageOut> {
    const access = this.getTransportAccess(llm._source.setup);
    return openAICallChatGenerate(access, llm.options, messages, null, null, maxTokens);
  },
  callChatGenerateWF(llm, messages: VChatMessageIn[], functions: VChatFunctionIn[] | null, forceFunctionName: string | null, maxTokens?: number): Promise<VChatMessageOrFunctionCallOut> {
    const access = this.getTransportAccess(llm._source.setup);
    return openAICallChatGenerate(access, llm.options, messages, functions, forceFunctionName, maxTokens);
  },
};


/**
 * This function either returns the LLM message, or function calls, or throws a descriptive error string
 */
export async function openAICallChatGenerate<TOut = VChatMessageOut | VChatMessageOrFunctionCallOut>(
  access: OpenAIAccessSchema, llmOptions: Partial<LLMOptionsOpenAI>, messages: VChatMessageIn[],
  functions: VChatFunctionIn[] | null, forceFunctionName: string | null,
  maxTokens?: number,
): Promise<TOut> {
  const { llmRef, llmTemperature = 0.5, llmResponseTokens } = llmOptions;
  try {
    return await apiAsync.llmOpenAI.chatGenerateWithFunctions.mutate({
      access,
      model: {
        id: llmRef!,
        temperature: llmTemperature,
        maxTokens: maxTokens || llmResponseTokens || 1024,
      },
      functions: functions ?? undefined,
      forceFunctionName: forceFunctionName ?? undefined,
      history: messages,
    }) as TOut;
  } catch (error: any) {
    const errorMessage = error?.message || error?.toString() || 'OpenAI Chat Generate Error';
    console.error(`openAICallChatGenerate: ${errorMessage}`);
    throw new Error(errorMessage);
  }
}