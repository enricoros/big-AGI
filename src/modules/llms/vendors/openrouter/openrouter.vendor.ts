import { OpenRouterIcon } from '~/common/components/icons/vendors/OpenRouterIcon';

import type { IModelVendor } from '../IModelVendor';
import type { OpenAIAccessSchema } from '../../server/openai/openai.router';

import { ModelVendorOpenAI } from '../openai/openai.vendor';

import { OpenRouterServiceSetup } from './OpenRouterServiceSetup';


// special symbols
export const isValidOpenRouterKey = (apiKey?: string) => !!apiKey && apiKey.startsWith('sk-or-') && apiKey.length > 40;

// use OpenAI-compatible host and key
export interface DOpenRouterServiceSettings {
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
export const ModelVendorOpenRouter: IModelVendor<DOpenRouterServiceSettings, OpenAIAccessSchema> = {
  id: 'openrouter',
  name: 'OpenRouter',
  displayRank: 40,
  location: 'cloud',
  instanceLimit: 1,
  hasFreeModels: true,
  hasBackendCapKey: 'hasLlmOpenRouter',

  // components
  Icon: OpenRouterIcon,
  ServiceSetupComponent: OpenRouterServiceSetup,

  // functions
  initializeSetup: (): DOpenRouterServiceSettings => ({
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
  rateLimitChatGenerate: async (llm) => {
    const now = Date.now();
    const elapsed = now - nextGenerationTs;
    const wait = llm.pricing?.chat?._isFree
      ? 5000 + 100 /* 5 seconds for free call, plus some safety margin */
      : 100;

    if (elapsed < wait) {
      const delay = wait - elapsed;
      nextGenerationTs = now + delay;
      await new Promise(resolve => setTimeout(resolve, delay));
    } else {
      nextGenerationTs = now;
    }
  },


  // OpenAI transport ('openrouter' dialect in 'access')
  rpcUpdateModelsOrThrow: ModelVendorOpenAI.rpcUpdateModelsOrThrow,

};

// rate limit timestamp
let nextGenerationTs = 0;
