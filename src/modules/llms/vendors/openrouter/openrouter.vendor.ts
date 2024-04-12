import { OpenRouterIcon } from '~/common/components/icons/vendors/OpenRouterIcon';

import type { IModelVendor } from '../IModelVendor';
import type { OpenAIAccessSchema } from '../../server/openai/openai.router';

import { LLMOptionsOpenAI, ModelVendorOpenAI } from '../openai/openai.vendor';
import { OpenAILLMOptions } from '../openai/OpenAILLMOptions';

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
 *  [~] merge the server-side models remapping from Azure OpenAI - not needed, using client-side remapping for now
 *  [x] decide whether to do UI work to improve the appearance - prioritized models
 *  [x] works!
 */
export const ModelVendorOpenRouter: IModelVendor<SourceSetupOpenRouter, OpenAIAccessSchema, LLMOptionsOpenAI> = {
  id: 'openrouter',
  name: 'OpenRouter',
  rank: 12,
  location: 'cloud',
  instanceLimit: 1,
  hasFreeModels: true,
  hasBackendCapKey: 'hasLlmOpenRouter',

  // components
  Icon: OpenRouterIcon,
  SourceSetupComponent: OpenRouterSourceSetup,
  LLMOptionsComponent: OpenAILLMOptions,

  // functions
  initializeSetup: (): SourceSetupOpenRouter => ({
    oaiHost: 'https://openrouter.ai/api',
    oaiKey: '',
  }),
  getTransportAccess: (partialSetup): OpenAIAccessSchema => ({
    dialect: 'openrouter',
    oaiKey: partialSetup?.oaiKey || '',
    oaiOrg: '',
    oaiHost: partialSetup?.oaiHost || '',
    heliKey: '',
    moderationCheck: false,
  }),

  // there is delay for OpenRouter Free API calls
  getRateLimitDelay: (llm) => {
    const now = Date.now();
    const elapsed = now - nextGenerationTs;
    const wait = llm.tmpIsFree
      ? 5000 + 100 /* 5 seconds for free call, plus some safety margin */
      : 100;

    if (elapsed < wait) {
      const delay = wait - elapsed;
      nextGenerationTs = now + delay;
      return delay;
    } else {
      nextGenerationTs = now;
      return 0;
    }
  },

  // OpenAI transport ('openrouter' dialect in 'access')
  rpcUpdateModelsOrThrow: ModelVendorOpenAI.rpcUpdateModelsOrThrow,
  rpcChatGenerateOrThrow: ModelVendorOpenAI.rpcChatGenerateOrThrow,
  streamingChatGenerateOrThrow: ModelVendorOpenAI.streamingChatGenerateOrThrow,
};

// rate limit timestamp
let nextGenerationTs = 0;
