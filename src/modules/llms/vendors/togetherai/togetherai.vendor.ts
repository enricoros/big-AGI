import { TogetherIcon } from '~/common/components/icons/vendors/TogetherIcon';

import type { IModelVendor } from '../IModelVendor';
import type { OpenAIAccessSchema } from '../../server/openai/openai.router';

import { LLMOptionsOpenAI, ModelVendorOpenAI } from '../openai/openai.vendor';
import { OpenAILLMOptions } from '../openai/OpenAILLMOptions';

import { TogetherAISourceSetup } from './TogetherAISourceSetup';


export interface SourceSetupTogetherAI {
  togetherKey: string;
  togetherHost: string;
  togetherFreeTrial: boolean;
}

export const ModelVendorTogetherAI: IModelVendor<SourceSetupTogetherAI, OpenAIAccessSchema, LLMOptionsOpenAI> = {
  id: 'togetherai',
  name: 'Together AI',
  rank: 17,
  location: 'cloud',
  instanceLimit: 1,
  hasBackendCapKey: 'hasLlmTogetherAI',

  // components
  Icon: TogetherIcon,
  SourceSetupComponent: TogetherAISourceSetup,
  LLMOptionsComponent: OpenAILLMOptions,

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

  // there is delay for OpenRouter Free API calls
  getRateLimitDelay: (_llm, partialSetup) => {
    const now = Date.now();
    const elapsed = now - nextGenerationTs;
    const wait = partialSetup?.togetherFreeTrial
      ? 1000 + 50 /* 1 seconds for free call, plus some safety margin */
      : 50;

    if (elapsed < wait) {
      const delay = wait - elapsed;
      nextGenerationTs = now + delay;
      return delay;
    } else {
      nextGenerationTs = now;
      return 0;
    }
  },


  // OpenAI transport ('togetherai' dialect in 'access')
  rpcUpdateModelsOrThrow: ModelVendorOpenAI.rpcUpdateModelsOrThrow,
  rpcChatGenerateOrThrow: ModelVendorOpenAI.rpcChatGenerateOrThrow,
  streamingChatGenerateOrThrow: ModelVendorOpenAI.streamingChatGenerateOrThrow,
};

// rate limit timestamp
let nextGenerationTs = 0;
