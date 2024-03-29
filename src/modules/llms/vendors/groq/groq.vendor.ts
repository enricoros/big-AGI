import { GroqIcon } from '~/common/components/icons/vendors/GroqIcon';

import type { IModelVendor } from '../IModelVendor';
import type { OpenAIAccessSchema } from '../../server/openai/openai.router';

import { LLMOptionsOpenAI, ModelVendorOpenAI } from '../openai/openai.vendor';
import { OpenAILLMOptions } from '../openai/OpenAILLMOptions';

import { GroqSourceSetup } from './GroqSourceSetup';


export interface SourceSetupGroq {
  groqKey: string;
}

export const ModelVendorGroq: IModelVendor<SourceSetupGroq, OpenAIAccessSchema, LLMOptionsOpenAI> = {
  id: 'groq',
  name: 'Groq',
  rank: 18,
  location: 'cloud',
  instanceLimit: 1,
  hasBackendCapKey: 'hasLlmGroq',

  // components
  Icon: GroqIcon,
  SourceSetupComponent: GroqSourceSetup,
  LLMOptionsComponent: OpenAILLMOptions,

  // functions
  initializeSetup: () => ({
    groqKey: '',
  }),
  validateSetup: (setup) => {
    return setup.groqKey?.length >= 50;
  },
  getTransportAccess: (partialSetup) => ({
    dialect: 'groq',
    oaiKey: partialSetup?.groqKey || '',
    oaiOrg: '',
    oaiHost: '',
    heliKey: '',
    moderationCheck: false,
  }),

  // OpenAI transport ('Groq' dialect in 'access')
  rpcUpdateModelsOrThrow: ModelVendorOpenAI.rpcUpdateModelsOrThrow,
  rpcChatGenerateOrThrow: ModelVendorOpenAI.rpcChatGenerateOrThrow,
  streamingChatGenerateOrThrow: ModelVendorOpenAI.streamingChatGenerateOrThrow,
};
