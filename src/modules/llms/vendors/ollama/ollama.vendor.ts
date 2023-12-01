import { backendCaps } from '~/modules/backend/state-backend';

import { OllamaIcon } from '~/common/components/icons/OllamaIcon';
import { apiAsync } from '~/common/util/trpc.client';

import type { IModelVendor } from '../IModelVendor';
import type { VChatMessageIn, VChatMessageOrFunctionCallOut, VChatMessageOut } from '../../transports/chatGenerate';
import type { OllamaAccessSchema } from '../../transports/server/ollama/ollama.router';

import { LLMOptionsOpenAI } from '../openai/openai.vendor';
import { OpenAILLMOptions } from '../openai/OpenAILLMOptions';

import { OllamaSourceSetup } from './OllamaSourceSetup';


export interface SourceSetupOllama {
  ollamaHost: string;
}


export const ModelVendorOllama: IModelVendor<SourceSetupOllama, LLMOptionsOpenAI, OllamaAccessSchema> = {
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
  getAccess: (partialSetup): OllamaAccessSchema => ({
    dialect: 'ollama',
    ollamaHost: partialSetup?.ollamaHost || '',
  }),
  callChatGenerate(llm, messages: VChatMessageIn[], maxTokens?: number): Promise<VChatMessageOut> {
    return ollamaCallChatGenerate(this.getAccess(llm._source.setup), llm.options, messages, maxTokens);
  },
  callChatGenerateWF(): Promise<VChatMessageOrFunctionCallOut> {
    throw new Error('Ollama does not support "Functions" yet');
  },
};


/**
 * This function either returns the LLM message, or throws a descriptive error string
 */
async function ollamaCallChatGenerate<TOut = VChatMessageOut>(
  access: OllamaAccessSchema, llmOptions: Partial<LLMOptionsOpenAI>, messages: VChatMessageIn[],
  maxTokens?: number,
): Promise<TOut> {
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
    }) as TOut;
  } catch (error: any) {
    const errorMessage = error?.message || error?.toString() || 'Ollama Chat Generate Error';
    console.error(`ollamaCallChatGenerate: ${errorMessage}`);
    throw new Error(errorMessage);
  }
}
