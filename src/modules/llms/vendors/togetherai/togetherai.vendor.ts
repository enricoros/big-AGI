import { backendCaps } from '~/modules/backend/state-backend';

import { TogetherIcon } from '~/common/components/icons/TogetherIcon';

import type { IModelVendor } from '../IModelVendor';
import type { OpenAIAccessSchema } from '../../server/openai/openai.router';

import { LLMOptionsOpenAI, ModelVendorOpenAI } from '../openai/openai.vendor';
import { OpenAILLMOptions } from '../openai/OpenAILLMOptions';

import { TogetherAISourceSetup } from './TogetherAISourceSetup';


export interface SourceSetupTogetherAI {
  togetherKey: string;
  togetherHost: string;
}

export const ModelVendorTogetherAI: IModelVendor<SourceSetupTogetherAI, OpenAIAccessSchema, LLMOptionsOpenAI> = {
  id: 'togetherai',
  name: 'Together AI',
  rank: 17,
  location: 'cloud',
  instanceLimit: 1,
  hasBackendCap: () => backendCaps().hasLlmTogetherAI,

  // components
  Icon: TogetherIcon,
  SourceSetupComponent: TogetherAISourceSetup,
  LLMOptionsComponent: OpenAILLMOptions,

  // functions
  initializeSetup: () => ({
    togetherKey: '',
    togetherHost: 'https://api.together.xyz',
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

  // OpenAI transport ('togetherai' dialect in 'access')
  rpcUpdateModelsQuery: ModelVendorOpenAI.rpcUpdateModelsQuery,
  rpcChatGenerateOrThrow: ModelVendorOpenAI.rpcChatGenerateOrThrow,
  streamingChatGenerateOrThrow: ModelVendorOpenAI.streamingChatGenerateOrThrow,
};
