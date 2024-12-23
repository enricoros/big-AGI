import { TogetherIcon } from '~/common/components/icons/vendors/TogetherIcon';

import type { IModelVendor } from '../IModelVendor';
import type { OpenAIAccessSchema } from '../../server/openai/openai.router';

import { ModelVendorOpenAI } from '../openai/openai.vendor';

import { TogetherAIServiceSetup } from './TogetherAIServiceSetup';


interface DTogetherAIServiceSettings {
  togetherKey: string;
  togetherHost: string;
  togetherFreeTrial: boolean;
}

export const ModelVendorTogetherAI: IModelVendor<DTogetherAIServiceSettings, OpenAIAccessSchema> = {
  id: 'togetherai',
  name: 'Together AI',
  displayRank: 34,
  location: 'cloud',
  instanceLimit: 1,
  hasBackendCapKey: 'hasLlmTogetherAI',

  // components
  Icon: TogetherIcon,
  ServiceSetupComponent: TogetherAIServiceSetup,

  // functions
  initializeSetup: () => ({
    togetherKey: '',
    togetherHost: 'https://api.together.xyz',
    togetherFreeTrial: false,
  }),
  validateSetup: (setup) => {
    return setup.togetherKey?.length >= 64;
  },
  getTransportAccess: (partialSetup) => ({
    dialect: 'togetherai',
    oaiKey: partialSetup?.togetherKey || '',
    oaiOrg: '',
    oaiHost: partialSetup?.togetherHost || '',
    heliKey: '',
    moderationCheck: false,
  }),

  // there is delay for Together Free API calls
  rateLimitChatGenerate: async (_llm, partialSetup) => {
    const now = Date.now();
    const elapsed = now - nextGenerationTs;
    const wait = partialSetup?.togetherFreeTrial
      ? 1000 + 50 /* 1 seconds for free call, plus some safety margin */
      : 50;

    if (elapsed < wait) {
      const delay = wait - elapsed;
      nextGenerationTs = now + delay;
      await new Promise(resolve => setTimeout(resolve, delay));
    } else {
      nextGenerationTs = now;
    }
  },


  // OpenAI transport ('togetherai' dialect in 'access')
  rpcUpdateModelsOrThrow: ModelVendorOpenAI.rpcUpdateModelsOrThrow,

};

// rate limit timestamp
let nextGenerationTs = 0;
