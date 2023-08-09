import { ModelVendor } from '../llm.types';

import { LLMOptionsOpenAI, ModelVendorOpenAI, SourceSetupOpenAI } from '~/modules/llms/openai/openai.vendor';
import { OpenAILLMOptions } from '~/modules/llms/openai/OpenAILLMOptions';

import { OpenRouterIcon } from './OpenRouterIcon';
import { OpenRouterSourceSetup } from './OpenRouterSourceSetup';

// special symbols
export const isValidOpenRouterKey = (apiKey?: string) => !!apiKey && apiKey.startsWith('sk-or-') && apiKey.length > 40;

// user OpenAI-compatible host and key
export interface SourceSetupOpenRouter extends Pick<SourceSetupOpenAI, 'oaiHost' | 'oaiKey'> {
}


/**
 * NOTE: the support is just started and incomplete - in particular it depends on some code that
 * hasn't been merged yet.
 *
 * TODO:
 *  - raise instanceLimit from 0 to 1 to continue development
 *  - add support to the OpenAI Router and Streaming function to add the headers required by OpenRouter
 *  - merge the server-side models remapping from Azure OpenAI
 *  - decide whether to do UI work to improve the appearance
 *  - shall work
 */
export const ModelVendorOpenRouter: ModelVendor<SourceSetupOpenRouter, LLMOptionsOpenAI> = {
  id: 'openrouter',
  name: 'OpenRouter',
  rank: 25,
  location: 'cloud',
  instanceLimit: 0,

  // components
  Icon: OpenRouterIcon,
  SourceSetupComponent: OpenRouterSourceSetup,
  LLMOptionsComponent: OpenAILLMOptions,

  // functions
  initalizeSetup: () => ({
    oaiHost: 'https://openrouter.ai/api',
  }),
  normalizeSetup: (partialSetup?: Partial<SourceSetupOpenRouter>) => ({
    oaiHost: '',
    oaiKey: '',
    ...partialSetup,
  }),
  callChat: ModelVendorOpenAI.callChat,
  callChatWithFunctions: ModelVendorOpenAI.callChatWithFunctions,
};