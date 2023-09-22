import { ModelVendor } from '../llm.types';

import { LLMOptionsOpenAI, ModelVendorOpenAI } from '~/modules/llms/openai/openai.vendor';
import { OpenAILLMOptions } from '~/modules/llms/openai/OpenAILLMOptions';

import { OpenRouterIcon } from './OpenRouterIcon';
import { OpenRouterSourceSetup } from './OpenRouterSourceSetup';

// special symbols
export const isValidOpenRouterKey = (apiKey?: string) => !!apiKey && apiKey.startsWith('sk-or-') && apiKey.length > 40;

// use OpenAI-compatible host and key
export interface SourceSetupOpenRouter {
  oaiKey: string;
  oaiHost: string;
}


/**
 * NOTE: the support is just started and incomplete - in particular it depends on some code that
 * hasn't been merged yet.
 *
 * Completion:
 *  [x] raise instanceLimit from 0 to 1 to continue development
 *  [x] add support to the OpenAI Router and Streaming function to add the headers required by OpenRouter (done in the access function)
 *  [ ] merge the server-side models remapping from Azure OpenAI - not needed, using client-side remapping for now
 *  [x] decide whether to do UI work to improve the appearance - prioritized models
 *  [x] works!
 */
export const ModelVendorOpenRouter: ModelVendor<SourceSetupOpenRouter, LLMOptionsOpenAI> = {
  id: 'openrouter',
  name: 'OpenRouter',
  rank: 25,
  location: 'cloud',
  instanceLimit: 1,

  // components
  Icon: OpenRouterIcon,
  SourceSetupComponent: OpenRouterSourceSetup,
  LLMOptionsComponent: OpenAILLMOptions,

  // functions
  initializeSetup: () => ({
    oaiHost: 'https://openrouter.ai/api',
    oaiKey: '',
  }),
  normalizeSetup: (partialSetup?: Partial<SourceSetupOpenRouter>) => ({
    oaiHost: '',
    oaiKey: '',
    ...partialSetup,
  }),
  callChat: ModelVendorOpenAI.callChat,
  callChatWithFunctions: ModelVendorOpenAI.callChatWithFunctions,
};